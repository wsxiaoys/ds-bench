use convex::ConvexClient;
use std::collections::BTreeMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables from .env if present.
    let _ = dotenvy::dotenv();

    // Read the text from the first command-line argument.
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: cargo run -- <text>");
        std::process::exit(1);
    }
    let text = args[1].clone();

    // Read the runId from /logs/artifacts/run-id.
    let run_id = std::fs::read_to_string("/logs/artifacts/run-id")
        .expect("Failed to read /logs/artifacts/run-id");
    let run_id = run_id.trim().to_string();

    // Get the Convex URL from the environment.
    let convex_url = std::env::var("CONVEX_URL").expect("CONVEX_URL must be set");

    // Connect to the Convex backend.
    let mut client = ConvexClient::new(&convex_url).await?;

    // Build the mutation arguments.
    let mut args = BTreeMap::new();
    args.insert("text".to_string(), text.into());
    args.insert("runId".to_string(), run_id.into());

    // Call the tasks:create mutation.
    let result = client.mutation("tasks:create", args).await?;
    println!("Mutation result: {:?}", result);

    Ok(())
}