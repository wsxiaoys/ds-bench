use std::collections::BTreeMap;
use std::env;
use std::fs;

use anyhow::{Context, Result};
use convex::ConvexClient;

#[tokio::main]
async fn main() -> Result<()> {
    // Best-effort: load environment variables from a .env file if one exists.
    let _ = dotenvy::dotenv();

    // Read the single command-line argument that will be used as the `text`
    // field for the task.
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        anyhow::bail!("Usage: rust-client <text>");
    }
    let text = args[1].clone();

    // Read the run-id from the artifacts directory. This file is written by
    // the orchestration layer and identifies the current run.
    let run_id = fs::read_to_string("/logs/artifacts/run-id")
        .context("failed to read /logs/artifacts/run-id")?
        .trim()
        .to_string();

    // The Convex deployment URL is provided via the CONVEX_URL environment
    // variable, which is set by the harness before this binary is invoked.
    let deployment_url = env::var("CONVEX_URL")
        .context("CONVEX_URL environment variable must be set")?;

    // Connect to the Convex backend.
    let mut client = ConvexClient::new(&deployment_url).await?;

    // Build the mutation arguments. `text` and `runId` are both strings.
    let mut mutation_args: BTreeMap<String, convex::Value> = BTreeMap::new();
    mutation_args.insert("text".to_string(), text.into());
    mutation_args.insert("runId".to_string(), run_id.into());

    // Call the `tasks:create` mutation exposed as `api.tasks.create`.
    let result = client
        .mutation("tasks:create", mutation_args)
        .await?;

    println!("{result:?}");

    Ok(())
}
