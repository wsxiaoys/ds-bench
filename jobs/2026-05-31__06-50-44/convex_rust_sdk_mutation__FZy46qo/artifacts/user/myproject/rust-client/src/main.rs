use std::{collections::BTreeMap, env};

use convex::{ConvexClient, Value};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenvy::from_filename("../.env.local");

    let text = env::args()
        .nth(1)
        .ok_or("Usage: rust-client <text>")?;
    let run_id = env::var("ZEALT_RUN_ID")?;
    let convex_url = env::var("CONVEX_URL")?;

    let mut args = BTreeMap::new();
    args.insert("text".to_string(), Value::String(text));
    args.insert("runId".to_string(), Value::String(run_id));

    let mut client = ConvexClient::new(&convex_url).await?;
    client.mutation("tasks:create", args).await?;

    Ok(())
}
