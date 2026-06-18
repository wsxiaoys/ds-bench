#!/usr/bin/env python3
"""
Execute shell commands in a Daytona sandbox and log the results.
"""

import os
from daytona import Daytona


def main():
    # Read run-id from environment variable
    run_id = os.environ.get('ZEALT_RUN_ID')
    if run_id is None:
        raise ValueError('ZEALT_RUN_ID environment variable is not set')

    # Sandbox name
    sandbox_name = f'exec-py-{run_id}'

    # Initialize Daytona client (authenticates via DAYTONA_API_KEY env var)
    daytona = Daytona()

    sandbox = None
    try:
        # Create a new sandbox
        print(f'Creating sandbox: {sandbox_name}')
        sandbox = daytona.create(sandbox_name)

        # Execute commands and collect results
        print('Executing uname -a...')
        uname_result = sandbox.process.exec('uname -a')
        uname_output = uname_result.result.strip()

        print('Executing pwd...')
        pwd_result = sandbox.process.exec('pwd')
        pwd_output = pwd_result.result.strip()

        print(f'Executing echo {run_id}...')
        echo_result = sandbox.process.exec(f'echo {run_id}')
        echo_output = echo_result.result.strip()

        # Write results to log file
        log_path = '/home/user/myproject/output.log'
        print(f'Writing results to {log_path}...')
        with open(log_path, 'w') as f:
            f.write(f'UNAME: {uname_output}\n')
            f.write(f'PWD: {pwd_output}\n')
            f.write(f'ECHO: {echo_output}\n')

        print('Done!')

    finally:
        # Always delete the sandbox, even on failure
        if sandbox is not None:
            print(f'Deleting sandbox: {sandbox_name}')
            daytona.delete(sandbox)


if __name__ == '__main__':
    main()