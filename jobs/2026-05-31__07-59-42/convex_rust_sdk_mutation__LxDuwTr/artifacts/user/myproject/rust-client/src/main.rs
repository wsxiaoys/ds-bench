use convex::ConvexClient;
use std::collections::BTreeMap;
use std::env;

#[tokio::main]
async fn main() {
    // Load .env file if present
    let _ = dotenvy::dotenv();

    // Get text from command-line argument
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: rust-client <text>");
        std::process::exit(1);
    }
    let text = args[1].clone();

    // Get runId from ZEALT_RUN_ID environment variable
    let run_id = env::var("ZEALT_RUN_ID").expect("ZEALT_RUN_ID environment variable must be set");

    // Get Convex URL from CONVEX_URL environment variable
    let convex_url = env::var("CONVEX_URL").expect("CONVEX_URL environment variable must be set");

    // Connect to Convex
    let mut client = ConvexClient::new(&convex_url).await.expect("Failed to connect to Convex");

    // Build mutation arguments
    let mut mutation_args = BTreeMap::new();
    mutation_args.insert("text".to_string(), convex::Value::String(text));
    mutation_args.insert("runId".to_string(), convex::Value::String(run_id));

    // Call the mutation
    let result = client
        .mutation("tasks:create", mutation_args)
        .await
        .expect("Mutation call failed");

    println!("Mutation result: {:?}", result);
}