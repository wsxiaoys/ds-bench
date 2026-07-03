import os
import lancedb
from lancedb.query import BooleanQuery, MatchQuery, Occur
from nltk.corpus import wordnet as wn

# Retrieve environment variables for LanceDB path and table name
LANCEDB_URI = os.environ.get("LANCEDB_URI", "/app/lancedb_data")
LANCEDB_TABLE = os.environ.get("LANCEDB_TABLE", "docs")

# Connect to LanceDB and open the table
db = lancedb.connect(LANCEDB_URI)
table = db.open_table(LANCEDB_TABLE)

# Build a native LanceDB FTS index on the content column if it doesn't exist
try:
    has_fts = any(
        getattr(idx, "index_type", None) == "FTS" and "content" in getattr(idx, "columns", [])
        for idx in table.list_indices()
    )
    if not has_fts:
        table.create_fts_index("content", use_tantivy=False, replace=False)
except Exception as e:
    # Fallback/safety: if the index already exists, we can ignore the error
    if "already exists" not in str(e).lower():
        raise

def expanded_search(query: str, k: int = 10) -> list[int]:
    """
    Perform full-text search with query expansion using WordNet synonyms.
    
    Parameters:
    -----------
    query : str
        The user query string.
    k : int, default 10
        The number of top document IDs to return.
        
    Returns:
    --------
    list[int]
        Top-k document IDs ordered by FTS score descending.
    """
    # Lowercase the query before expansion
    query_lowered = query.lower()
    
    # Split the query by whitespace
    tokens = query_lowered.split()
    if not tokens:
        return []
        
    expanded_terms = []
    seen_all = set()
    
    for token in tokens:
        # The original query term must remain in the expansion
        if token not in seen_all:
            seen_all.add(token)
            expanded_terms.append(token)
            
        synonyms_for_token = []
        seen_syns = set()
        
        # Look up WordNet synonyms
        for synset in wn.synsets(token):
            for lemma in synset.lemmas():
                name = lemma.name().lower()
                
                # Only keep synonyms that are a single token (no '_' or whitespace)
                if "_" in name or " " in name:
                    continue
                    
                # Skip the original token itself
                if name == token:
                    continue
                    
                if name not in seen_syns:
                    seen_syns.add(name)
                    synonyms_for_token.append(name)
                    if len(synonyms_for_token) == 3:
                        break
            if len(synonyms_for_token) == 3:
                break
                
        # Add the synonyms to the expanded terms
        for syn in synonyms_for_token:
            if syn not in seen_all:
                seen_all.add(syn)
                expanded_terms.append(syn)
                
    # If no terms were expanded (should not happen since original tokens are kept), return empty
    if not expanded_terms:
        return []
        
    # Construct an OR/SHOULD boolean FTS query over the expansion
    queries = [(Occur.SHOULD, MatchQuery(term, "content")) for term in expanded_terms]
    boolean_query = BooleanQuery(queries=queries)
    
    # Execute the search and retrieve the top-k document IDs
    results = table.search(boolean_query, query_type="fts").limit(k).to_list()
    
    # Return the top-k document IDs as a list of Python int
    return [int(r["id"]) for r in results]
