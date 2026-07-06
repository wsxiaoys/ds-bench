"""Query expansion with WordNet synonyms + LanceDB native FTS.

Exposes ``expanded_search(query, k=10) -> list[int]`` which enriches each
whitespace-separated query token with up to three single-token WordNet
synonyms and runs a SHOULD (OR) boolean full-text search over the union of
the original terms and their synonyms.
"""

from __future__ import annotations

import os
from functools import lru_cache

import lancedb
from lancedb.query import BooleanQuery, MatchQuery, Occur
from nltk.corpus import wordnet as wn

# How many synonyms (at most) to keep per query token.
MAX_SYNONYMS_PER_TOKEN = 3


def _wordnet_synonyms(token: str) -> list[str]:
    """Return up to ``MAX_SYNONYMS_PER_TOKEN`` single-token WordNet synonyms.

    Synonyms are gathered across all senses of ``token`` via
    ``wn.synonyms``.  Only lemma names that are a single token (i.e. contain
    no underscore or whitespace) are retained, the list is de-duplicated
    (case-insensitively) and the original ``token`` is excluded so it can be
    re-added separately by the caller.
    """
    synonyms: list[str] = []
    seen: set[str] = set()
    for sense in wn.synonyms(token):
        for lemma in sense:
            name = lemma.lower()
            # Skip multi-word lemmas ("railroad_car", "cable car", ...).
            if "_" in name or any(ch.isspace() for ch in name):
                continue
            # Skip the original token itself (re-added by the caller) and
            # skip duplicates.
            if name == token or name in seen:
                continue
            seen.add(name)
            synonyms.append(name)
            if len(synonyms) >= MAX_SYNONYMS_PER_TOKEN:
                return synonyms
    return synonyms


def _expand_query(query: str) -> list[str]:
    """Expand a query string into the ordered list of FTS terms.

    The original query term always remains in the expansion (first), followed
    by up to ``MAX_SYNONYMS_PER_TOKEN`` of its single-token WordNet synonyms.
    The final term list is de-duplicated while preserving order.
    """
    terms: list[str] = []
    seen: set[str] = set()
    for token in query.lower().split():
        candidates = [token] + _wordnet_synonyms(token)
        for cand in candidates:
            if cand and cand not in seen:
                seen.add(cand)
                terms.append(cand)
    return terms


@lru_cache(maxsize=1)
def _get_table():
    """Open (once) the LanceDB table described by the environment."""
    uri = os.environ["LANCEDB_URI"]
    table_name = os.environ["LANCEDB_TABLE"]
    db = lancedb.connect(uri)
    table = db.open_table(table_name)

    # Create the native FTS index if it does not yet exist.  ``replace=False``
    # means an existing index is left untouched; we swallow the resulting
    # error so that repeated calls to ``expanded_search`` are idempotent.
    try:
        table.create_fts_index("content", use_tantivy=False, replace=False)
    except Exception:
        # Index already exists (or another benign condition) - nothing to do.
        pass

    return table


def expanded_search(query: str, k: int = 10) -> list[int]:
    """Run an expanded FTS search and return the top-k document IDs.

    Each whitespace-separated token of ``query`` is lowercased and enriched
    with up to three single-token WordNet synonyms.  A SHOULD (OR) boolean
    FTS query is built over the union of original terms and synonyms and run
    against the native LanceDB FTS index on the ``content`` column.

    Parameters
    ----------
    query:
        The raw user query.
    k:
        Maximum number of document IDs to return.

    Returns
    -------
    list[int]
        The IDs of the top-k matching documents ordered by FTS score
        descending.
    """
    table = _get_table()
    terms = _expand_query(query)

    # Fallback: if expansion produced no usable terms (e.g. empty query),
    # run a plain search on the original query string.
    if not terms:
        results = table.search(query, query_type="fts").limit(k).to_list()
        return [int(r["id"]) for r in results]

    # Build an OR/SHOULD boolean query: every term is a SHOULD clause so that
    # documents matching any of the (original + synonym) terms are returned,
    # scored by how many / which terms they match.
    boolean_query = BooleanQuery(
        [(Occur.SHOULD, MatchQuery(term, "content")) for term in terms]
    )

    results = table.search(boolean_query, query_type="fts").limit(k).to_list()
    return [int(r["id"]) for r in results]