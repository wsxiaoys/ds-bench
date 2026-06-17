import os
import daytona

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    sandbox_name = f"exec-py-{run_id}"
    
    client = daytona.Daytona()
    params = daytona.CreateSandboxBaseParams(name=sandbox_name)
    sandbox = client.create(params)
    
    try:
        res_uname = sandbox.process.exec("uname -a")
        res_pwd = sandbox.process.exec("pwd")
        res_echo = sandbox.process.exec(f"echo {run_id}")
        
        output_file = "/home/user/myproject/output.log"
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, "w") as f:
            f.write(f"UNAME: {res_uname.result.strip()}\n")
            f.write(f"PWD: {res_pwd.result.strip()}\n")
            f.write(f"ECHO: {res_echo.result.strip()}\n")
            
    finally:
        client.delete(sandbox)

if __name__ == "__main__":
    main()
