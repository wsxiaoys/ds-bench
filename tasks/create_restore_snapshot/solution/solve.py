import os
from e2b import Sandbox

def solve():
    print("Creating sandbox...")
    sandbox = Sandbox.create()
    
    print("Writing file...")
    sandbox.files.write("/home/user/checkpoint.txt", "checkpoint 1")
    
    print("Creating snapshot...")
    # Let's check python sdk for create_snapshot.
    # Wait, in the python SDK it's sandbox.create_snapshot() ? No, let's use JS if python is not sure, or we can use REST API.
    # Actually I found `createSnapshot()` in JS. Is it in Python? I can just use JS in the solution to be safe.
    pass

if __name__ == "__main__":
    solve()
