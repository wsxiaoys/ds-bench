# Tigris CLI: Apply a 7-Day Object Expiration TTL to a Bucket

## Background
Tigris buckets can be configured with an object expiration TTL so that objects are automatically deleted after a fixed number of days. This is a common requirement for ephemeral evaluation buckets that should not accumulate state indefinitely. The Tigris CLI (`@tigrisdata/cli`) exposes this as the `tigris buckets lifecycle create` subcommand (documented at https://www.tigrisdata.com/docs/cli/buckets/lifecycle/), which configures bucket-level object expiration in days.

## Requirements
- Read the Harbor run identifier from `/logs/artifacts/run-id` and use it to derive a unique bucket name `harbor-ttl-${run_id}`. Note: S3 bucket names can only contain lowercase letters, numbers, dots, and hyphens. You must normalize the bucket name by converting it to lowercase and replacing any invalid characters (like underscores) with hyphens.
- Create that bucket using the Tigris CLI.
- Configure the bucket's object expiration TTL to 7 days using the documented Tigris CLI subcommand `tigris buckets lifecycle create`.
- The bucket configuration returned by `tigris buckets lifecycle list <bucket> --json` must reflect that the 7-day TTL is in effect.

## Implementation Guide
1. Open a terminal in the project directory `/home/user/ttl-task`.
2. Read the run id from `/logs/artifacts/run-id` and trim any trailing whitespace.
3. Derive the bucket name as `harbor-ttl-${run_id}`. Note: S3 bucket names can only contain lowercase letters, numbers, dots, and hyphens. You must normalize the bucket name by converting it to lowercase and replacing any invalid characters (like underscores) with hyphens.
4. Create the bucket with:
   ```bash
   tigris buckets create harbor-ttl-${run_id}
   ```
5. Apply the 7-day expiration TTL with the documented subcommand:
   ```bash
   tigris buckets lifecycle create harbor-ttl-${run_id} --expire-days 7
   ```
6. The container's login shell is pre-wired to expose the Tigris credentials to the CLI: `/etc/profile.d/tigris-auth.sh` maps `TIGRIS_STORAGE_ACCESS_KEY_ID`/`TIGRIS_STORAGE_SECRET_ACCESS_KEY` to the AWS-compatible variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=auto`) consumed by the `tigris` CLI. If you invoke `tigris` from a non-login shell, source this file first or pass the AWS_* variables inline.

## Constraints
- Project path: `/home/user/ttl-task`
- Bucket name MUST be exactly `harbor-ttl-${run_id}` where `${run_id}` is the contents of `/logs/artifacts/run-id` (trimmed of trailing whitespace). Do NOT hardcode any other suffix. Note: S3 bucket names can only contain lowercase letters, numbers, dots, and hyphens. You must normalize the bucket name by converting it to lowercase and replacing any invalid characters (like underscores) with hyphens.
- TTL MUST be exactly 7 days. Use `--expire-days 7`.
- Use the Tigris CLI (`@tigrisdata/cli`) only — do not configure TTL via raw S3/HTTP, the AWS CLI, or any other tool.
- The bucket must remain provisioned after the task completes so the verifier can inspect it. The verifier will delete the bucket after assertions.

## Integrations
- Tigris Object Storage (credentials provided as `TIGRIS_STORAGE_ACCESS_KEY_ID` and `TIGRIS_STORAGE_SECRET_ACCESS_KEY`).