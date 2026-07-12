use convex::ConvexClient;
use std::collections::BTreeMap;
use std::env;
use std::fs;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables from .env if present
    dotenvy::dotenv().ok();

    // Get the text argument from command line
    let args: Vec<String> = env::args().collect();
    let text = args
        .get(1)
        .ok_or("Usage: rust-client <text>")?
        .clone();

    // Read the runId from /logs/artifacts/run-id
    let run_id = fs::read_to_string("/logs/artifacts/run-id")?;
    let run_id = run_id.trim().to_string();

    // Get the Convex URL from environment
    let convex_url = env::var("CONVEX_URL")?;

    // Connect to the Convex backend
    let mut client = ConvexClient::new(convex_url).await?;

    // Build the mutation arguments
    let mut map = BTreeMap::new();
    map.insert("text".to_string(), convex::Value::String(text.clone()));
    map.insert("runId".to_string(), convex::Value::String(run_id));

    // Call the mutation
    let result = client.mutation("tasks:create", map).await?;

    println!("Created task with result: {:?}", result);

    Ok(())
}