#!/bin/bash
set -euo pipefail

# Check if environment variables are set
if [ -z "${REFLEX_CLOUD_TOKEN:-}" ]; then
    echo "Error: REFLEX_CLOUD_TOKEN is not set" >&2
    exit 1
fi

if [ -z "${REFLEX_CLOUD_PROJECT_ID:-}" ]; then
    echo "Error: REFLEX_CLOUD_PROJECT_ID is not set" >&2
    exit 1
fi

# Generate a unique app name using secrets.token_hex(4)
SUFFIX=$(python3 -c "import secrets; print(secrets.token_hex(4))")
APP_NAME="myproject-${SUFFIX}"
echo "Generated unique app name: ${APP_NAME}"

# Define cleanup function to kill any background processes on port 3000 or 8000
cleanup() {
    echo "Cleaning up any background processes on ports 3000 and 8000..."
    python3 -c "
import os, signal
ports = [3000, 8000]
target_ports_hex = {f'{port:04X}' for port in ports}
target_inodes = set()
for proto in ('tcp', 'tcp6', 'udp', 'udp6'):
    path = f'/proc/net/{proto}'
    if not os.path.exists(path):
        continue
    try:
        with open(path, 'r') as f:
            lines = f.readlines()
        for line in lines[1:]:
            parts = line.strip().split()
            if len(parts) < 10:
                continue
            local_addr = parts[1]
            inode = parts[9]
            if ':' in local_addr:
                port_hex = local_addr.split(':')[-1]
                if port_hex in target_ports_hex:
                    target_inodes.add(inode)
    except Exception:
        pass
if target_inodes:
    pids_to_kill = set()
    for pid_str in os.listdir('/proc'):
        if not pid_str.isdigit():
            continue
        pid = int(pid_str)
        if pid == os.getpid():
            continue
        fd_dir = f'/proc/{pid_str}/fd'
        if not os.path.exists(fd_dir):
            continue
        try:
            for fd in os.listdir(fd_dir):
                fd_path = os.path.join(fd_dir, fd)
                if os.path.islink(fd_path):
                    target = os.readlink(fd_path)
                    if target.startswith('socket:['):
                        inode = target[8:-1]
                        if inode in target_inodes:
                            pids_to_kill.add(pid)
        except Exception:
            pass
    for pid in pids_to_kill:
        try:
            print(f'Killing process {pid} using port(s)')
            os.kill(pid, signal.SIGKILL)
        except Exception as e:
            print(f'Failed to kill {pid}: {e}')
"
    # Also kill any leftover reflex, bun, node, granian processes just in case
    pkill -f "reflex" || true
    pkill -f "bun" || true
    pkill -f "node" || true
    pkill -f "granian" || true
}

trap cleanup EXIT

# Perform the deployment
echo "Starting deployment to Reflex Cloud..."
uv run reflex deploy \
    --app-name "${APP_NAME}" \
    --project "${REFLEX_CLOUD_PROJECT_ID}" \
    --token "${REFLEX_CLOUD_TOKEN}" \
    --no-interactive

# Record the deployed app name to the log file in the format "Deployed app: <app_name>"
echo "Deployed app: ${APP_NAME}" > /home/user/myproject/deploy.log
echo "Deployment completed successfully! Recorded app name: ${APP_NAME}"
