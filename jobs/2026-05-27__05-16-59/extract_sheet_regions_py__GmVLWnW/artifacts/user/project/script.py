import os
import httpx
from llama_cloud import LlamaCloud

def main():
    # Ensure output directory exists
    output_dir = "/home/user/project/output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize LlamaCloud client
    # It automatically picks up LLAMA_CLOUD_API_KEY from environment
    client = LlamaCloud()
    
    file_path = "/home/user/project/data/sales.xlsx"
    
    # Upload file
    with open(file_path, "rb") as f:
        file_obj = client.files.create(file=f, purpose="parse")
        
    print(f"Uploaded file ID: {file_obj.id}")
    
    # Run sheets parse job
    print("Running sheets parse job...")
    job = client.beta.sheets.parse(
        file_id=file_obj.id, 
        config={"generate_additional_metadata": True}
    )
    
    print(f"Job finished with status: {job.status}")
    
    log_lines = []
    log_lines.append(f"Job ID: {job.id}")
    log_lines.append(f"Job Status: {job.status}")
    
    regions = job.regions if job.regions else []
    log_lines.append(f"Region Count: {len(regions)}")
    
    for region in regions:
        # region is a Region object
        region_id = region.region_id
        sheet_name = region.sheet_name
        location = region.location
        
        log_lines.append(f"Region: {region_id} sheet={sheet_name} location={location}")
        
        # Download parquet table
        parquet_path = os.path.join(output_dir, f"region_{region_id}.parquet")
        
        result_table = client.beta.sheets.get_result_table(
            region_type=region.region_type,
            spreadsheet_job_id=job.id,
            region_id=region_id
        )
        
        # Download the actual file
        with httpx.stream("GET", result_table.url) as response:
            with open(parquet_path, "wb") as f:
                for chunk in response.iter_bytes():
                    f.write(chunk)
                    
        log_lines.append(f"Parquet: {parquet_path}")
        
    # Write log file
    log_path = os.path.join(output_dir, "sheets.log")
    with open(log_path, "w") as f:
        f.write("\n".join(log_lines) + "\n")
        
    print(f"Done. Wrote {len(regions)} regions and log to {output_dir}")

if __name__ == "__main__":
    main()
