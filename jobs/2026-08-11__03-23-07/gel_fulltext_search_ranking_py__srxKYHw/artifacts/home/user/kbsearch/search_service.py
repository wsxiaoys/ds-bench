import gel
import asyncio
import re

async def search_articles(
    query: str,
    *,
    status: str | None = None,
    tag: str | None = None,
    limit: int = 10,
    offset: int = 0,
) -> dict:
    # Verification
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 0:
        raise ValueError("limit must be a non-negative integer")
    if not isinstance(offset, int) or isinstance(offset, bool) or offset < 0:
        raise ValueError("offset must be a non-negative integer")
    if status is not None and status not in ("draft", "published", "archived"):
        raise ValueError("status must be one of 'draft', 'published', 'archived'")

    # Handle empty query
    if not query or not query.strip():
        return {
            "query": query,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "results": []
        }

    # Connect to Gel
    client = gel.create_async_client()
    try:
        # Query
        q = """
        with
          matches := (
            select fts::search(Article, <str>$search_query, language := 'eng')
            filter
              (not exists <optional str>$status or .object.status = <ArticleStatus><str>$status)
              and
              (not exists <optional str>$tag or <str>$tag in .object.tags)
          ),
          paged_matches := (
            select matches
            order by matches.score desc then matches.object.slug asc
            offset <int64>$offset
            limit <int64>$limit
          )
        select {
          total := count(matches),
          multi results := (
            select (
              slug := paged_matches.object.slug,
              title := paged_matches.object.title,
              status := <str>paged_matches.object.status,
              tags := array_agg((select paged_matches.object.tags order by paged_matches.object.tags asc)),
              score := paged_matches.score
            )
            order by paged_matches.score desc then paged_matches.object.slug asc
          )
        }
        """
        
        res = await client.query_single(
            q,
            search_query=query,
            status=status,
            tag=tag,
            offset=offset,
            limit=limit
        )
        
        # Highlight helper
        def highlight_title(title: str, query_str: str) -> str:
            pieces = query_str.split()
            terms = set()
            for p in pieces:
                term = re.sub(r'^[^a-zA-Z0-9]+', '', p)
                term = re.sub(r'[^a-zA-Z0-9]+$', '', term)
                if term:
                    terms.add(term)
            if not terms:
                return title
            sorted_terms = sorted(list(terms), key=len, reverse=True)
            pattern = r'(?<![a-zA-Z0-9])(' + '|'.join(re.escape(t) for t in sorted_terms) + r')(?![a-zA-Z0-9])'
            return re.sub(pattern, r'<b>\1</b>', title, flags=re.IGNORECASE)

        results = []
        for i, item in enumerate(res.results):
            rank = offset + i + 1
            highlight = highlight_title(item.title, query)
            results.append({
                "rank": rank,
                "slug": item.slug,
                "title": item.title,
                "status": item.status,
                "tags": list(item.tags) if item.tags else [],
                "score": float(item.score),
                "highlight": highlight
            })

        return {
            "query": query,
            "total": res.total,
            "limit": limit,
            "offset": offset,
            "results": results
        }
    finally:
        await client.aclose()

if __name__ == "__main__":
    # Small test
    res = asyncio.run(search_articles("quokka"))
    import pprint
    pprint.pprint(res)
