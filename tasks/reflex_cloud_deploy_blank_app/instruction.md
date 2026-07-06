# Deploy a Blank Reflex App to Reflex Cloud

## Background
Reflex is a Python full-stack web framework. Reflex Cloud is the managed hosting service offered by the Reflex team that lets developers deploy a Reflex application from the CLI without provisioning any infrastructure.

In this task you will scaffold a minimal Reflex application from the `blank` template, prepare it for cloud deployment, write a reproducible deploy script, and push the app to Reflex Cloud non-interactively using your `REFLEX_CLOUD_TOKEN` and `REFLEX_CLOUD_PROJECT_ID`.

## Requirements
- Scaffold a minimal Reflex project at `/home/user/myproject` using `uv` and the `blank` template.
- Produce a `requirements.txt` file at the project root that lists `reflex` as a dependency.
- Author an executable deployment script `deploy.sh` at the project root that, when executed, performs the entire deploy flow non-interactively against Reflex Cloud and records the deployed app name to `/home/user/myproject/deploy.log`.
- `deploy.sh` must read `REFLEX_CLOUD_TOKEN` and `REFLEX_CLOUD_PROJECT_ID` from the environment (do not hardcode these values).
- The deployed app name MUST be generated at deploy time so each run is unique (use a short random suffix produced inside `deploy.sh` itself — e.g. via `python3 -c "import secrets; print(secrets.token_hex(4))"` or `openssl rand -hex 4`). Do **NOT** pass the suffix in via an environment variable.
- Write the deployed app name to the log file `/home/user/myproject/deploy.log` in the format `Deployed app: <app_name>`.
- Run `deploy.sh` so the app is actually deployed to Reflex Cloud.

## Implementation Hints
- Use `uv init && uv add reflex && uv run reflex init --template blank` to scaffold the project without any interactive prompts.
- Generate `requirements.txt` from the locked uv environment (e.g. `uv pip freeze > requirements.txt`). The file must contain a line for `reflex`.
- For the Reflex Cloud CLI, the official non-interactive flag is `--no-interactive`. Pass the token with `--token` and the project with `--project`. You may also pass `--app-name` to set the unique app name on the deploy command.
- The `reflex cloud apps list` command supports a `--json` flag which is convenient if you want to inspect deployments programmatically; the task verifier only requires that at least one deployment row is present.
- Before exiting, `deploy.sh` MUST kill any Reflex background processes it may have started (frontend on port 3000 or backend on port 8000) so the environment is left clean.

