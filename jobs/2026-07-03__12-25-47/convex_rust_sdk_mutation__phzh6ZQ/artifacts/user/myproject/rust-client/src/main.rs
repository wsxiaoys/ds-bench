use convex::ConvexClient;
use convex::Value;
use std::collections::BTreeMap;
use std::env;
use std::fs;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let convex_url = env::var("CONVEX_URL")?;

    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: rust-client <text>");
        std::process::exit(1);
    }
    let text = args[1].clone();

    let run_id = fs::read_to_string("/logs/artifacts/run-id")?;
    let run_id = run_id.trim().to_string();

    let mut client = ConvexClient::new(&convex_url).await?;
    let mut map: BTreeMap<String, Value> = BTreeMap::new();
    map.insert("text".to_string(), Value::String(text));
    map.insert("runId".to_string(), Value::String(run_id));
    client.mutation("tasks:create", map).await?;

    Ok(())
}
