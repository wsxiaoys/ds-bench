import os
from daytona_sdk import Daytona, CreateSandboxFromImageParams, Image

def main():
    run_id = os.environ.get('ZEALT_RUN_ID', 'default-run-id')
    daytona = Daytona()
    
    image = Image.debian_slim('3.12').pip_install(['requests', 'pyyaml'])
    sandbox_name = f"decl-py-{run_id}"
    
    print(f"Creating sandbox {sandbox_name}...")
    sandbox = daytona.create(CreateSandboxFromImageParams(name=sandbox_name, image=image))
    
    try:
        print("Running python code...")
        code = """
import requests
import yaml
print(f"requests: {requests.__version__}")
print(f"yaml: {yaml.__version__}")
"""
        response = sandbox.process.code_run(code)
        
        result = response.result
        print(f"Result: {result}")
        
        with open('/home/user/myproject/output.log', 'w') as f:
            f.write(result)
            
    finally:
        print(f"Deleting sandbox {sandbox_name}...")
        sandbox.delete()

if __name__ == '__main__':
    main()