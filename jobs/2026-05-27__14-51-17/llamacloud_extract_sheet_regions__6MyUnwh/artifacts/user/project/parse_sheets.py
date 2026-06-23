#!/usr/bin/env python3
"""
Extract Spreadsheet Regions with LlamaSheets (Python)

This script uses LlamaCloud's beta.sheets API to intelligently identify and 
extract tabular regions from messy spreadsheets, emitting normalized Parquet 
files plus rich worksheet/region metadata.
"""

import os
import sys
import urllib.request
from pathlib import Path
from datetime import datetime
from llama_cloud import LlamaCloud

# Paths
PROJECT_DIR = Path("/home/user/project")
DATA_DIR = PROJECT_DIR / "data"
OUTPUT_DIR = PROJECT_DIR / "output"
SPREADSHEET_PATH = DATA_DIR / "sales.xlsx"
LOG_PATH = OUTPUT_DIR / "sheets.log"

def ensure_output_dir():
    """Ensure the output directory exists."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def log_entry(log_lines, message):
    """Add an entry to the log lines list and print it."""
    log_lines.append(message)
    print(message)

def download_parquet(url, output_path):
    """Download a Parquet file from a URL to the specified path."""
    urllib.request.urlretrieve(url, output_path)
    
    # Verify the file is not empty
    if os.path.getsize(output_path) == 0:
        raise ValueError(f"Downloaded Parquet file is empty: {output_path}")

def main():
    """Main execution function."""
    log_lines = []
    
    try:
        # Verify input file exists
        if not SPREADSHEET_PATH.exists():
            raise FileNotFoundError(f"Spreadsheet not found: {SPREADSHEET_PATH}")
        
        ensure_output_dir()
        
        # Initialize LlamaCloud client (reads LLAMA_CLOUD_API_KEY from environment)
        client = LlamaCloud()
        
        # Upload the file for parsing
        log_entry(log_lines, f"Uploading spreadsheet: {SPREADSHEET_PATH}")
        
        with open(SPREADSHEET_PATH, 'rb') as f:
            file_response = client.files.create(
                file=f,
                purpose="parse"
            )
        
        file_id = file_response.id
        log_entry(log_lines, f"File ID: {file_id}")
        
        # Run LlamaSheets job with additional metadata
        log_entry(log_lines, "Starting LlamaSheets parsing job...")
        
        job = client.beta.sheets.parse(
            file_id=file_id,
            config={"generate_additional_metadata": True}
        )
        
        # Log job information
        job_id = job.id
        job_status = job.status
        
        log_entry(log_lines, f"Job ID: {job_id}")
        log_entry(log_lines, f"Job Status: {job_status}")
        
        # Verify job succeeded
        if job_status != "SUCCESS":
            raise RuntimeError(f"Job failed with status: {job_status}")
        
        # Log worksheet metadata if available
        if hasattr(job, 'worksheet_metadata') and job.worksheet_metadata:
            log_entry(log_lines, f"Worksheet Count: {len(job.worksheet_metadata)}")
            for ws_meta in job.worksheet_metadata:
                title = getattr(ws_meta, 'title', 'N/A')
                log_entry(log_lines, f"Worksheet: {title}")
        
        # Process each detected region
        regions = job.regions
        region_count = len(regions)
        
        log_entry(log_lines, f"Region Count: {region_count}")
        
        if region_count == 0:
            raise RuntimeError("No regions detected in spreadsheet")
        
        # Download Parquet for each region
        for region in regions:
            region_id = region.region_id
            region_type = region.region_type
            sheet_name = getattr(region, 'sheet_name', 'unknown')
            location = getattr(region, 'location', 'unknown')
            
            # Log region information
            log_entry(log_lines, f"Region: {region_id} sheet={sheet_name} location={location}")
            
            # Get the Parquet download URL
            result_table = client.beta.sheets.get_result_table(
                region_type=region_type,
                spreadsheet_job_id=job_id,
                region_id=region_id
            )
            
            parquet_url = result_table.url
            parquet_path = OUTPUT_DIR / f"region_{region_id}.parquet"
            
            # Download the Parquet file
            log_entry(log_lines, f"Downloading Parquet for region {region_id}...")
            download_parquet(parquet_url, parquet_path)
            
            # Log the Parquet file path
            log_entry(log_lines, f"Parquet: {parquet_path}")
            log_entry(log_lines, f"  Size: {os.path.getsize(parquet_path)} bytes")
        
        # Write log file
        log_entry(log_lines, f"\nCompleted at: {datetime.utcnow().isoformat()}")
        
        with open(LOG_PATH, 'w') as log_file:
            log_file.write('\n'.join(log_lines))
        
        print(f"\n✓ Log written to: {LOG_PATH}")
        print(f"✓ Processed {region_count} region(s)")
        
        return 0
        
    except Exception as e:
        error_msg = f"ERROR: {str(e)}"
        log_entry(log_lines, error_msg)
        
        # Write log file even on error
        with open(LOG_PATH, 'w') as log_file:
            log_file.write('\n'.join(log_lines))
        
        print(f"\n✗ {error_msg}", file=sys.stderr)
        print(f"✗ Log written to: {LOG_PATH}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())