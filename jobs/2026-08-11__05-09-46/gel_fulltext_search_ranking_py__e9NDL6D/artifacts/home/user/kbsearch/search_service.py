import asyncio
import re
import gel

def get_highlight_terms(query: str) -> list[str]:
    raw_pieces = query.split()
    highlight_terms = []
    for piece in raw_pieces:
        # strip leading and trailing non-alphanumeric characters
        cleaned = re.sub(r'^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$', '', piece)
        if cleaned:
            highlight_terms.append(cleaned)
    return highlight_terms

def get_search_terms(query: str) -> list[str]:
    # replace any character that is not alphanumeric, hyphen, underscore, or whitespace with a space
    cleaned = re.sub(r'[^\w\-\s]', ' ', query)
    raw_pieces = cleaned.split()
    search_terms = []
    seen = set()
    for piece in raw_pieces:
        # strip leading and trailing non-alphanumeric characters
        sub_cleaned = re.sub(r'^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$', '', piece)
        if sub_cleaned and sub_cleaned not in seen:
            seen.add(sub_cleaned)
            search_terms.append(sub_cleaned)
    return search_terms

def highlight_title(title: str, highlight_terms: list[str]) -> str:
    spans = []
    for term in highlight_terms:
        if not term:
            continue
        # Find all case-insensitive whole-word occurrences
        pattern = r'(?<![a-zA-Z0-9])' + re.escape(term) + r'(?![a-zA-Z0-9])'
        for match in re.finditer(pattern, title, re.IGNORECASE):
            spans.append(match.span())
            
    if not spans:
        return title
        
    # Merge overlapping/adjacent spans
    spans.sort(key=lambda x: (x[0], -x[1]))
    merged = []
    for start, end in spans:
        if not merged:
            merged.append((start, end))
        else:
            prev_start, prev_end = merged[-1]
            if start <= prev_end:
                merged[-1] = (prev_start, max(prev_end, end))
            else:
                merged.append((start, end))
                
    # Rebuild title with <b> tags
    parts = []
    last_idx = 0
    for start, end in merged:
        parts.append(title[last_idx:start])
        parts.append("<b>" + title[start:end] + "</b>")
        last_idx = end
    parts.append(title[last_idx:])
    return "".join(parts)

async def search_articles(
    query: str,
    *,
    status: str | None = None,
    tag: str | None = None,
    limit: int = 10,
    offset: int = 0,
) -> dict:
    # Rejected arguments validation
    if status is not None and status not in ("draft", "published", "archived"):
        raise ValueError("status must be 'draft', 'published', or 'archived'")
        
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 0:
        raise ValueError("limit must be a non-negative integer")
        
    if not isinstance(offset, int) or isinstance(offset, bool) or offset < 0:
        raise ValueError("offset must be a non-negative integer")

    # Empty query handling
    if not query or not query.strip():
        return {
            "query": query,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "results": []
        }

    search_terms = get_search_terms(query)
    if not search_terms:
        return {
            "query": query,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "results": []
        }

    # Construct the search query string for fts::search
    # Join with OR to match at least one term
    query_str = " OR ".join(search_terms)

    # Database query
    has_status = status is not None
    has_tag = tag is not None

    q = """
    with
      res_all := (
        select fts::search(Article, <str>$query_str, language := 'eng')
        filter
          (.object.status = <ArticleStatus>$status if <bool>$has_status else true)
          and
          (<str>$tag in .object.tags if <bool>$has_tag else true)
      ),
      total_count := count(res_all),
      res_paginated := (
        select res_all
        order by res_all.score desc then res_all.object.slug asc
        offset <int64>$offset
        limit <int64>$limit
      )
    select {
      total := total_count,
      results := (
        for r in res_paginated union {
          slug := r.object.slug,
          title := r.object.title,
          status := <str>r.object.status,
          tags := (with x := r.object.tags select x order by x asc),
          score := <float64>r.score
        }
      )
    };
    """

    async with gel.create_async_client() as client:
        db_res = await client.query(
            q,
            query_str=query_str,
            offset=offset,
            limit=limit,
            status=status if status is not None else "draft",  # dummy if has_status is False
            has_status=has_status,
            tag=tag if tag is not None else "",  # dummy if has_tag is False
            has_tag=has_tag
        )

    if not db_res:
        return {
            "query": query,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "results": []
        }

    total = db_res[0].total
    db_results = db_res[0].results if db_res[0].results is not None else []

    highlight_terms = get_highlight_terms(query)

    results = []
    for i, item in enumerate(db_results):
        rank = offset + i + 1
        highlighted = highlight_title(item.title, highlight_terms)
        results.append({
            "rank": rank,
            "slug": item.slug,
            "title": item.title,
            "status": item.status,
            "tags": list(item.tags) if item.tags is not None else [],
            "score": item.score,
            "highlight": highlighted
        })

    return {
        "query": query,
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": results
    }
