#!/usr/bin/env python3
"""
Verify that the parse job was created with the correct tier.
"""

from llama_cloud import LlamaCloud

# Initialize LlamaCloud client
client = LlamaCloud()

# Read the log file to get the job ID
with open("/home/user/myproject/output.log", "r") as f:
    log_content = f.read()
    for line in log_content.split("\n"):
        if line.startswith("Job ID:"):
            job_id = line.split(": ")[1].strip()
            break

print(f"Verifying job: {job_id}")

# Retrieve the job from the API
job_response = client.parsing.get(job_id)
job = job_response.job

print(f"Job tier: {job.tier}")
print(f"Job status: {job.status}")

# Verify the tier is cost_effective
assert job.tier == "cost_effective", f"Expected tier 'cost_effective', got '{job.tier}'"
print("✓ Job was created with tier='cost_effective'")

# Verify page ranges configuration
if hasattr(job_response, 'raw_parameters') and job_response.raw_parameters:
    print(f"Raw parameters: {job_response.raw_parameters}")
    if 'page_ranges' in job_response.raw_parameters:
        page_ranges = job_response.raw_parameters['page_ranges']
        print(f"Page ranges: {page_ranges}")
        if 'target_pages' in page_ranges:
            assert page_ranges['target_pages'] == "1-2", f"Expected target_pages '1-2', got '{page_ranges['target_pages']}'"
            print("✓ Job was created with page_ranges.target_pages='1-2'")

print("\n✓ All verifications passed!")