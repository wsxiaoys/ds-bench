use std::collections::BTreeMap;
use std::env;
use std::fs;
use convex::{ConvexClient, Value};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables (e.g. from .env file)
    dotenvy::dotenv().ok();

    // Get the CONVEX_URL environment variable
    let convex_url = env::var("CONVEX_URL")
        .expect("CONVEX_URL environment variable must be set");

    // Read the text argument from the command line
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Error: Please provide a text argument.");
        eprintln!("Usage: cargo run -- <text>");
        std::process::exit(1);
    }
    let text = args[1].clone();

    // Read the run ID from /logs/artifacts/run-id
    let run_id = fs::read_to_string("/logs/artifacts/run-id")?
        .trim()
        .to_string();

    println!("Connecting to Convex at: {}", convex_url);
    println!("Inserting task with text: '{}' and runId: '{}'", text, run_id);

    // Initialize the Convex client
    let mut client = ConvexClient::new(&convex_url).await?;

    // Prepare mutation arguments
    let mut args_map = BTreeMap::new();
    args_map.insert("text".to_string(), Value::String(text));
    args_map.insert("runId".to_string(), Value::String(run_id));

    // Call the mutation "tasks:create"
    let result = client.mutation("tasks:create", args_map).await?;
    println!("Mutation result: {:?}", result);

    Ok(())
}
