import os
import nltk

# Ensure WordNet corpora are present
for pkg in ('wordnet', 'omw-1.4'):
    try:
        nltk.data.find(f'corpora/{pkg}')
    except LookupError:
        nltk.download(pkg, quiet=True)

from nltk.corpus import wordnet as wn  # noqa: E402

import lancedb  # noqa: E402

_TABLE = None
_IDX_BUILT = False


def _get_table():
    global _TABLE
    if _TABLE is None:
        db = lancedb.connect(os.environ['LANCEDB_URI'])
        _TABLE = db.open_table(os.environ['LANCEDB_TABLE'])
    return _TABLE


def _ensure_fts_index():
    global _IDX_BUILT
    if _IDX_BUILT:
        return
    table = _get_table()
    # Check if an FTS index on 'content' already exists; only create if not present.
    has_fts = False
    try:
        indices = table.list_indices()
    except Exception:
        indices = []
    for idx in indices:
        try:
            cols = getattr(idx, 'columns', None)
            idx_type = str(getattr(idx, 'index_type', '') or getattr(idx, 'type', '') or '')
        except Exception:
            continue
        if cols is None:
            continue
        col_names = [c if isinstance(c, str) else getattr(c, 'name', str(c)) for c in cols]
        if any(name == 'content' or name.endswith('content') for name in col_names):
            if 'FTS' in idx_type.upper() or 'INVERTED' in idx_type.upper() or not idx_type:
                has_fts = True
                break
    if not has_fts:
        try:
            table.create_fts_index("content", use_tantivy=False, replace=False)
        except Exception as e:
            # Tolerate "already exists" cases since some lancedb versions raise.
            if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                raise
    _IDX_BUILT = True


def _expand_token(token: str) -> list[str]:
    """Return the lowercase token plus up to 3 single-word WordNet synonyms."""
    token = token.lower()
    out = []
    seen = {token}
    # wn.synonyms returns a list of lists (per sense) of lemma names.
    groups = []
    try:
        groups = wn.synonyms(token) or []
    except Exception:
        groups = []
    if not groups:
        # Fallback: derive from synsets directly.
        try:
            for syn in wn.synsets(token):
                groups.append([n.replace('_', ' ').replace('-', ' ') for n in syn.lemma_names()])
        except Exception:
            groups = []
    for group in groups:
        for lemma in group:
            lemma = lemma.lower().strip()
            if not lemma or lemma in seen:
                continue
            # Keep only single-token synonyms (no '_' or whitespace).
            if any(ch in lemma for ch in ('_', ' ', '\t', '\n')):
                continue
            seen.add(lemma)
            out.append(lemma)
            if len(out) >= 3:
                break
        if len(out) >= 3:
            break
    return [token] + out


def expanded_search(query: str, k: int = 10) -> list[int]:
    tokens = query.lower().split()
    expansion_tokens = []
    for t in tokens:
        expansion_tokens.extend(_expand_token(t))
    # Deduplicate while preserving order.
    seen = set()
    uniq = []
    for t in expansion_tokens:
        if t not in seen:
            seen.add(t)
            uniq.append(t)

    table = _get_table()
    _ensure_fts_index()

    # Space-separated terms query is the simplest OR semantics and is deterministic.
    fts_query = ' '.join(uniq)
    results = table.search(fts_query, query_type="fts").limit(k).to_list()
    return [r['id'] for r in results]
