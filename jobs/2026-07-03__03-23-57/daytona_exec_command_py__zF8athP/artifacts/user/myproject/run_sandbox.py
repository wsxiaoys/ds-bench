import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Read run-id
    with open('/logs/artifacts/run-id', 'r') as f:
        run_id = f.read().strip()

    print(f"Read run-id: {run_id}")

    daytona = Daytona()
    params = CreateSandboxFromSnapshotParams(name=f"exec-py-{run_id}")
    sandbox = None
    try:
        print(f"Creating sandbox: exec-py-{run_id}")
        sandbox = daytona.create(params)
        print("Sandbox created successfully")
        
        # 1. Execute uname -a
        print("Executing uname -a...")
        res_uname = sandbox.process.exec("uname -a")
        uname_out = res_uname.result.strip()
        print(f"uname -a output: {uname_out}")
        
        # 2. Execute pwd
        print("Executing pwd...")
        res_pwd = sandbox.process.exec("pwd")
        pwd_out = res_pwd.result.strip()
        print(f"pwd output: {pwd_out}")
        
        # 3. Execute echo <run_id>
        print(f"Executing echo {run_id}...")
        res_echo = sandbox.process.exec(f"echo {run_id}")
        echo_out = res_echo.result.strip()
        print(f"echo output: {echo_out}")
        
        # Write to local log file
        log_path = "/home/user/myproject/output.log"
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w") as f:
            f.write(f"UNAME: {uname_out}\n")
            f.write(f"PWD: {pwd_out}\n")
            f.write(f"ECHO: {echo_out}\n")
        print(f"Results successfully written to {log_path}")

    finally:
        if sandbox:
            print("Deleting sandbox...")
            try:
                daytona.delete(sandbox)
                print("Sandbox deleted successfully")
            except Exception as e:
                print(f"Error deleting sandbox: {e}")

if __name__ == "__main__":
    main()
