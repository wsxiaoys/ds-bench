import os
from e2b_code_interpreter import Sandbox

api_key = os.environ.get('E2B_API_KEY')

with Sandbox.create(api_key=api_key) as sandbox:
    # Create two separate code execution contexts
    ctx1 = sandbox.create_code_context()
    ctx2 = sandbox.create_code_context()

    # In ctx1, set magic_number = 42
    sandbox.run_code("magic_number = 42", context=ctx1)

    # In ctx2, set magic_number = 99
    sandbox.run_code("magic_number = 99", context=ctx2)

    # Read magic_number in ctx1 and write to /home/user/out1.txt
    sandbox.run_code(
        "with open('/home/user/out1.txt', 'w') as f: f.write(str(magic_number))",
        context=ctx1,
    )

    # Read magic_number in ctx2 and write to /home/user/out2.txt
    sandbox.run_code(
        "with open('/home/user/out2.txt', 'w') as f: f.write(str(magic_number))",
        context=ctx2,
    )

    # Download both files from the sandbox to local workspace
    content1 = sandbox.files.read('/home/user/out1.txt')
    content2 = sandbox.files.read('/home/user/out2.txt')

    # Handle bytes vs str
    if isinstance(content1, bytes):
        text1 = content1.decode('utf-8').rstrip('\n')
    else:
        text1 = str(content1).rstrip('\n')
    if isinstance(content2, bytes):
        text2 = content2.decode('utf-8').rstrip('\n')
    else:
        text2 = str(content2).rstrip('\n')

    with open('/home/user/host_out1.txt', 'w') as f:
        f.write(text1)
    with open('/home/user/host_out2.txt', 'w') as f:
        f.write(text2)

    print(f"ctx1 magic_number -> /home/user/host_out1.txt: {text1}")
    print(f"ctx2 magic_number -> /home/user/host_out2.txt: {text2}")

print("Done. Sandbox closed.")
