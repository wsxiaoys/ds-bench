import json
import gel

def main():
    with open("seed_data.json", "r", encoding="utf-8") as f:
        articles = json.load(f)

    client = gel.create_client()

    query = """
    with
      slug := <str>$slug,
      title := <str>$title,
      summary := <str>$summary,
      body := <str>$body,
      status := <ArticleStatus>$status,
      tags := <array<str>>$tags
    insert Article {
      slug := slug,
      title := title,
      summary := summary,
      body := body,
      status := status,
      tags := array_unpack(tags)
    }
    unless conflict on .slug
    else (
      update Article set {
        title := title,
        summary := summary,
        body := body,
        status := status,
        tags := array_unpack(tags)
      }
    );
    """

    for art in articles:
        client.query(
            query,
            slug=art["slug"],
            title=art["title"],
            summary=art["summary"],
            body=art["body"],
            status=art["status"],
            tags=art.get("tags", [])
        )
    print(f"Successfully seeded {len(articles)} articles.")

if __name__ == "__main__":
    main()
