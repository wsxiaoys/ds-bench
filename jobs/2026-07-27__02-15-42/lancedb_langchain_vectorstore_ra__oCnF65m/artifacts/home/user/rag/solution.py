import json
import re
import lancedb
from typing import Optional, List, Any, Dict
from langchain_community.vectorstores import LanceDB
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from local_embeddings import HashEmbeddings

def rewrite_where_clause(where: Optional[str]) -> Optional[str]:
    """Prefix standalone metadata fields (doc_id, source, section, timestamp) with 'metadata.'

    so they are correctly resolved against the nested struct in the LanceDB schema.
    """
    if not where:
        return where
    # Match any of the fields as standalone words not preceded by a dot
    pattern = r'(?<!\.)\b(doc_id|source|section|timestamp)\b'
    return re.sub(pattern, r'metadata.\1', where)

class CustomLanceDB(LanceDB):
    """Custom LanceDB vector store subclass that:

    1. Correctly returns CustomLanceDB instances from classmethods.
    2. Overrides MMR search to return documents in the exact order selected by the MMR algorithm.
    3. Forwards keyword arguments (such as prefilter=True) to MMR search functions.
    """

    @classmethod
    def from_texts(
        cls,
        texts: List[str],
        embedding: Any,
        metadatas: Optional[List[dict]] = None,
        connection: Optional[Any] = None,
        vector_key: Optional[str] = "vector",
        id_key: Optional[str] = "id",
        text_key: Optional[str] = "text",
        table_name: Optional[str] = "vectorstore",
        api_key: Optional[str] = None,
        region: Optional[str] = None,
        mode: Optional[str] = "overwrite",
        distance: Optional[str] = "l2",
        reranker: Optional[Any] = None,
        relevance_score_fn: Optional[Any] = None,
        **kwargs: Any,
    ) -> "CustomLanceDB":
        instance = cls(
            connection=connection,
            embedding=embedding,
            vector_key=vector_key,
            id_key=id_key,
            text_key=text_key,
            table_name=table_name,
            api_key=api_key,
            region=region,
            mode=mode,
            distance=distance,
            reranker=reranker,
            relevance_score_fn=relevance_score_fn,
            **kwargs,
        )
        instance.add_texts(texts, metadatas=metadatas)
        return instance

    def max_marginal_relevance_search(
        self,
        query: str,
        k: Optional[int] = None,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        filter: Optional[Any] = None,
        **kwargs: Any,
    ) -> List[Document]:
        if k is None:
            k = self.limit

        if self._embedding is None:
            raise ValueError(
                "For MMR search, you must specify an embedding function on creation."
            )

        embedding = self._embedding.embed_query(query)
        docs = self.max_marginal_relevance_search_by_vector(
            embedding,
            k,
            fetch_k,
            lambda_mult=lambda_mult,
            filter=filter,
            **kwargs,
        )
        return docs

    def max_marginal_relevance_search_by_vector(
        self,
        embedding: List[float],
        k: Optional[int] = None,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        filter: Optional[Any] = None,
        **kwargs: Any,
    ) -> List[Document]:
        import numpy as np
        from langchain_community.vectorstores.utils import maximal_marginal_relevance
        
        results = self._query(
            query=embedding,
            k=fetch_k,
            filter=filter,
            **kwargs,
        )
        mmr_selected = maximal_marginal_relevance(
            np.array(embedding, dtype=np.float32),
            results["vector"].to_pylist(),
            k=k or self.limit,
            lambda_mult=lambda_mult,
        )

        candidates = self.results_to_docs(results)

        # Return documents in the exact MMR selection order!
        selected_results = [candidates[i] for i in mmr_selected]
        return selected_results

def build_index() -> CustomLanceDB:
    """(Re)creates the documents table at /home/user/rag/lancedb from corpus.json

    and returns the LangChain LanceDB vector store object.
    Calling it more than once leaves exactly one full copy of the corpus in the table (no duplicates).
    """
    corpus_path = "/home/user/rag/corpus.json"
    with open(corpus_path, "r", encoding="utf-8") as f:
        corpus = json.load(f)
        
    docs = []
    for item in corpus:
        doc = Document(
            page_content=item["text"],
            metadata={
                "doc_id": item["doc_id"],
                "source": item["source"],
                "section": item["section"],
                "timestamp": item["timestamp"]
            }
        )
        docs.append(doc)
        
    db_dir = "/home/user/rag/lancedb"
    db = lancedb.connect(db_dir)
    
    embeddings = HashEmbeddings()
    db_store = CustomLanceDB.from_documents(
        docs,
        embeddings,
        connection=db,
        table_name="documents",
        mode="overwrite"
    )
    return db_store

def get_retriever(search_type: str, search_kwargs: dict) -> BaseRetriever:
    """Returns a LangChain retriever (a BaseRetriever) over the documents table

    configured with the given search_type ("similarity" or "mmr") and search_kwargs dict.
    Invoking it returns LangChain Document objects whose metadata carries doc_id.
    """
    db_dir = "/home/user/rag/lancedb"
    db = lancedb.connect(db_dir)
    db_store = CustomLanceDB(connection=db, table_name="documents", embedding=HashEmbeddings())
    
    kwargs = search_kwargs.copy()
    
    # If filter is present, rewrite it and ensure pre-filtering is enabled
    if "filter" in kwargs:
        if isinstance(kwargs["filter"], str):
            kwargs["filter"] = rewrite_where_clause(kwargs["filter"])
        kwargs["prefilter"] = True
    elif "where" in kwargs:
        if isinstance(kwargs["where"], str):
            kwargs["filter"] = rewrite_where_clause(kwargs["where"])
        else:
            kwargs["filter"] = kwargs["where"]
        kwargs["prefilter"] = True
        del kwargs["where"]
        
    return db_store.as_retriever(search_type=search_type, search_kwargs=kwargs)

def retrieve(query: str, k: int, where: Optional[str] = None) -> List[str]:
    """Similarity search returning a list[str] of doc_id values ordered from most similar to least similar,

    length at most k. When where is provided, it is applied as a pre-filter.
    """
    db_dir = "/home/user/rag/lancedb"
    db = lancedb.connect(db_dir)
    db_store = CustomLanceDB(connection=db, table_name="documents", embedding=HashEmbeddings())
    
    filter_str = rewrite_where_clause(where) if where else None
    
    docs = db_store.similarity_search(
        query,
        k=k,
        filter=filter_str,
        prefilter=True if filter_str else False
    )
    
    doc_ids = []
    for doc in docs:
        doc_id = doc.metadata.get("doc_id")
        if doc_id:
            doc_ids.append(doc_id)
    return doc_ids

def retrieve_mmr(query: str, k: int, fetch_k: int, lambda_mult: float, where: Optional[str] = None) -> List[str]:
    """MMR search returning a list[str] of doc_id values in the order the MMR algorithm selects them,

    using the supplied k, fetch_k, and lambda_mult, and honoring the optional where metadata filter.
    """
    db_dir = "/home/user/rag/lancedb"
    db = lancedb.connect(db_dir)
    db_store = CustomLanceDB(connection=db, table_name="documents", embedding=HashEmbeddings())
    
    filter_str = rewrite_where_clause(where) if where else None
    
    docs = db_store.max_marginal_relevance_search(
        query,
        k=k,
        fetch_k=fetch_k,
        lambda_mult=lambda_mult,
        filter=filter_str,
        prefilter=True if filter_str else False
    )
    
    doc_ids = []
    for doc in docs:
        doc_id = doc.metadata.get("doc_id")
        if doc_id:
            doc_ids.append(doc_id)
    return doc_ids
