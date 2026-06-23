import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"
VERIFY_SCRIPT = os.path.join(PROJECT_DIR, "verify.ts")

def test_register_user_validation():
    """Priority 1: Use a custom script and `tsx` to evaluate the tRPC router directly."""
    verify_script_content = """
import { appRouter } from './router';
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
const createCaller = t.createCallerFactory(appRouter);
const caller = createCaller({});

async function runTests() {
  // Test 1: Valid input
  try {
    const res = await caller.registerUser({
      username: 'bob123',
      email: 'bob@example.com',
      password: 'securepassword'
    });
    if (!res.success || res.user.username !== 'bob123' || res.user.email !== 'bob@example.com') {
      console.error('Test 1 Failed: Invalid response for valid input', res);
      process.exit(1);
    }
    if ('password' in res.user) {
      console.error('Test 1 Failed: Password should not be in the response', res);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test 1 Failed: Valid input threw an error', err);
    process.exit(1);
  }

  // Test 2: Invalid username (too short)
  try {
    await caller.registerUser({
      username: 'bo',
      email: 'bob@example.com',
      password: 'securepassword'
    });
    console.error('Test 2 Failed: Expected error for short username');
    process.exit(1);
  } catch (err: any) {
    if (err.code !== 'BAD_REQUEST' && !err.message.includes('validation')) {
       // It might be a Zod error inside TRPCError
       if (!err.message.includes('String must contain at least 3 character(s)') && !err.message.toLowerCase().includes('invalid')) {
         console.error('Test 2 Failed: Unexpected error type', err);
         process.exit(1);
       }
    }
  }

  // Test 3: Invalid email
  try {
    await caller.registerUser({
      username: 'bob123',
      email: 'not-an-email',
      password: 'securepassword'
    });
    console.error('Test 3 Failed: Expected error for invalid email');
    process.exit(1);
  } catch (err: any) {
    // Expected to throw
  }

  // Test 4: Invalid password (too short)
  try {
    await caller.registerUser({
      username: 'bob123',
      email: 'bob@example.com',
      password: 'short'
    });
    console.error('Test 4 Failed: Expected error for short password');
    process.exit(1);
  } catch (err: any) {
    // Expected to throw
  }

  console.log('All tests passed');
}

runTests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
"""
    with open(VERIFY_SCRIPT, "w") as f:
        f.write(verify_script_content)

    # Run the verification script
    result = subprocess.run(
        ["npx", "tsx", "verify.ts"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0, f"Verification script failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    assert "All tests passed" in result.stdout, f"Expected 'All tests passed' in output, got: {result.stdout}"
