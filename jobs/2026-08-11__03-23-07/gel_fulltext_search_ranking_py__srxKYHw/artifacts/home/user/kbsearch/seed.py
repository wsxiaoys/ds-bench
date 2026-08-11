import json
import os
import gel

def seed():
    # Read seed data
    seed_data_path = os.path.join(os.path.dirname(__file__), "seed_data.json")
    with open(seed_data_path, "r") as f:
        articles = json.load(f)

    # Connect to Gel
    client = gel.create_client()

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
    )
    """

    print(f"Seeding {len(articles)} articles...")
    for article in articles:
        client.query_single(
            query,
            slug=article["slug"],
            title=article["title"],
            summary=article["summary"],
            body=article["body"],
            status=article["status"],
            tags=article.get("tags", [])
        )
    
    print("Seeding complete successfully.")
    client.close()

if __name__ == "__main__":
    seed()
