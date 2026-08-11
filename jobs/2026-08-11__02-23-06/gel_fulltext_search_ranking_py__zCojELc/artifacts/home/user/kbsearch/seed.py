import json
import gel

def main():
    client = gel.create_client()
    
    with open("seed_data.json", "r", encoding="utf-8") as f:
        articles = json.load(f)
        
    query = """
    insert Article {
      slug := <str>$slug,
      title := <str>$title,
      summary := <str>$summary,
      body := <str>$body,
      status := <ArticleStatus>$status,
      tags := array_unpack(<array<str>>$tags)
    }
    unless conflict on .slug
    else (
      update Article
      set {
        title := <str>$title,
        summary := <str>$summary,
        body := <str>$body,
        status := <ArticleStatus>$status,
        tags := array_unpack(<array<str>>$tags)
      }
    );
    """
    
    for article in articles:
        client.query(
            query,
            slug=article["slug"],
            title=article["title"],
            summary=article["summary"],
            body=article["body"],
            status=article["status"],
            tags=article.get("tags", []),
        )
    print(f"Successfully seeded {len(articles)} articles.")

if __name__ == "__main__":
    main()
