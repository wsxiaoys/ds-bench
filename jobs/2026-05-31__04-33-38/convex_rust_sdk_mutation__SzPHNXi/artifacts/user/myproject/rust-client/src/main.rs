use convex::{ConvexClient, Value};
use dotenvy::dotenv;
use std::collections::BTreeMap;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <text>", args[0]);
        std::process::exit(1);
    }
    let text = &args[1];

    let convex_url = env::var("CONVEX_URL").expect("CONVEX_URL must be set");
    let run_id = env::var("ZEALT_RUN_ID").expect("ZEALT_RUN_ID must be set");

    let mut client = ConvexClient::new(&convex_url).await?;

    let mut args_map = BTreeMap::new();
    args_map.insert("text".to_string(), Value::from(text.clone()));
    args_map.insert("runId".to_string(), Value::from(run_id));

    client.mutation("tasks:create", args_map).await?;

    println!("Mutation called successfully");

    Ok(())
}
