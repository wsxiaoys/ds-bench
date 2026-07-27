#!/usr/bin/env bash
set -euo pipefail

# ── Scheduling Lab Setup ───────────────────────────────────────────────
# Creates two deployments of the same flow against the local Prefect server:
#   pulse-active-<run-id>  → active 30s schedule → runs become Late
#   pulse-paused-<run-id>  → paused schedule     → no upcoming runs
#
# Idempotent: re-running converges to the same final state.
# ────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_ID_FILE="/logs/artifacts/run-id"
PREFECT_API_URL="${PREFECT_API_URL:-http://127.0.0.1:4200/api}"

if [ ! -f "$RUN_ID_FILE" ]; then
  echo "ERROR: run-id file not found at $RUN_ID_FILE"
  exit 1
fi

RUN_ID="$(cat "$RUN_ID_FILE" | tr -d '[:space:]')"
echo "==> Using run-id: $RUN_ID"

ACTIVE_DEPLOY="pulse-active-${RUN_ID}"
PAUSED_DEPLOY="pulse-paused-${RUN_ID}"

echo "==> Active deployment : $ACTIVE_DEPLOY"
echo "==> Paused deployment : $PAUSED_DEPLOY"

cd "$SCRIPT_DIR"

python3 - "$RUN_ID" "$ACTIVE_DEPLOY" "$PAUSED_DEPLOY" <<'PYEOF'
import sys
import asyncio
from datetime import timedelta

from prefect import get_client
from prefect.client.schemas.actions import DeploymentScheduleCreate
from prefect.client.schemas.schedules import IntervalSchedule

run_id = sys.argv[1]
active_name = sys.argv[2]
paused_name = sys.argv[3]


async def setup():
    async with get_client() as client:
        # ── 1. Register (or find) the flow ──────────────────────────────
        flow_id = await client.create_flow_from_name("pulse-flow")
        print(f"Flow 'pulse-flow' registered with id: {flow_id}")

        # ── 2. Remove any existing deployments with our names ───────────
        existing = await client.read_deployments()
        for dep in existing:
            if dep.name in (active_name, paused_name):
                print(f"Deleting existing deployment: {dep.name} (id={dep.id})")
                await client.delete_deployment(dep.id)

        # ── 3. Create the ACTIVE deployment (30s interval, active=True) ─
        active_schedule = DeploymentScheduleCreate(
            schedule=IntervalSchedule(interval=timedelta(seconds=30)),
            active=True,
        )
        dep_active_id = await client.create_deployment(
            flow_id=flow_id,
            name=active_name,
            schedules=[active_schedule],
        )
        print(f"Created active deployment: {active_name} (id={dep_active_id})")

        # ── 4. Create the PAUSED deployment (30s interval, active=False) ─
        paused_schedule = DeploymentScheduleCreate(
            schedule=IntervalSchedule(interval=timedelta(seconds=30)),
            active=False,
        )
        dep_paused_id = await client.create_deployment(
            flow_id=flow_id,
            name=paused_name,
            schedules=[paused_schedule],
        )
        print(f"Created paused deployment: {paused_name} (id={dep_paused_id})")

    print("\n✓ Setup complete.")
    print(f"  {active_name} — active schedule, runs will become Late")
    print(f"  {paused_name} — paused schedule, no upcoming runs")


asyncio.run(setup())
PYEOF

echo ""
echo "==> Done. Open http://127.0.0.1:4200 to inspect the deployments."
