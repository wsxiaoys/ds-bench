import os
from e2b_code_interpreter import Sandbox

def main():
    print("Starting E2B Sandbox...")
    # Use context manager to ensure the sandbox is closed at the end
    with Sandbox.create() as sandbox:
        print(f"Sandbox created with ID: {sandbox.sandbox_id}")
        
        # Create two separate code execution contexts within this sandbox
        print("Creating context 1 (ctx1)...")
        ctx1 = sandbox.create_code_context()
        
        print("Creating context 2 (ctx2)...")
        ctx2 = sandbox.create_code_context()
        
        # In ctx1, execute Python code that sets a variable magic_number = 42
        print("Setting magic_number = 42 in ctx1...")
        sandbox.run_code("magic_number = 42", context=ctx1)
        
        # In ctx2, execute Python code that sets a variable magic_number = 99
        print("Setting magic_number = 99 in ctx2...")
        sandbox.run_code("magic_number = 99", context=ctx2)
        
        # In ctx1, execute Python code to read magic_number and write it to a file /home/user/out1.txt
        print("Writing magic_number to /home/user/out1.txt in ctx1...")
        sandbox.run_code("with open('/home/user/out1.txt', 'w') as f: f.write(str(magic_number))", context=ctx1)
        
        # In ctx2, execute Python code to read magic_number and write it to a file /home/user/out2.txt
        print("Writing magic_number to /home/user/out2.txt in ctx2...")
        sandbox.run_code("with open('/home/user/out2.txt', 'w') as f: f.write(str(magic_number))", context=ctx2)
        
        # Download both files from the sandbox to the local workspace
        print("Downloading files from sandbox...")
        content1 = sandbox.files.read('/home/user/out1.txt')
        content2 = sandbox.files.read('/home/user/out2.txt')
        
        # Ensure they are strings
        if isinstance(content1, bytes):
            content1 = content1.decode('utf-8')
        if isinstance(content2, bytes):
            content2 = content2.decode('utf-8')
            
        print(f"Content from out1.txt: {content1.strip()}")
        print(f"Content from out2.txt: {content2.strip()}")
        
        # Write to local workspace /home/user/host_out1.txt and /home/user/host_out2.txt
        local_path1 = '/home/user/host_out1.txt'
        local_path2 = '/home/user/host_out2.txt'
        
        print(f"Saving to local file: {local_path1}")
        with open(local_path1, 'w') as f:
            f.write(content1)
            
        print(f"Saving to local file: {local_path2}")
        with open(local_path2, 'w') as f:
            f.write(content2)
            
        print("Execution and file download complete!")

if __name__ == '__main__':
    main()
