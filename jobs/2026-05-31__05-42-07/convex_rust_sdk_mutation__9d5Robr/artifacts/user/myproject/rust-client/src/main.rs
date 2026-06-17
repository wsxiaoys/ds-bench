use convex::ConvexClient;
use std::env;
use std::collections::BTreeMap;
use convex::Value;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenvy::dotenv();

    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <text>", args[0]);
        std::process::exit(1);
    }
    let text = args[1].clone();

    let run_id = env::var("ZEALT_RUN_ID").expect("ZEALT_RUN_ID not set");
    let convex_url = env::var("CONVEX_URL").expect("CONVEX_URL not set");

    let mut client = ConvexClient::new(&convex_url).await?;

    let mut mutation_args = BTreeMap::new();
    mutation_args.insert("text".to_string(), Value::String(text.clone()));
    mutation_args.insert("runId".to_string(), Value::String(run_id.clone()));

    client.mutation("tasks:create", mutation_args).await?;
    println!("Successfully inserted task with text '{}' and runId '{}'", text, run_id);

    Ok(())
}
