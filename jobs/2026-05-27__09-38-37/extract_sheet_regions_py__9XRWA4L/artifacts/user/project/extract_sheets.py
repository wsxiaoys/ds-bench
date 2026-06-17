import os
import requests
from llama_cloud import LlamaCloud

def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable not set.")
        return

    client = LlamaCloud(api_key=api_key)
    
    file_path = "/home/user/project/data/sales.xlsx"
    output_dir = "/home/user/project/output"
    os.makedirs(output_dir, exist_ok=True)

    print(f"Uploading {file_path}...")
    with open(file_path, "rb") as f:
        file_obj = client.files.create(file=f, purpose="parse")
    
    print(f"Starting LlamaSheets job for file ID: {file_obj.id}...")
    job = client.beta.sheets.parse(
        file_id=file_obj.id,
        config={"generate_additional_metadata": True}
    )

    print(f"Job finished with status: {job.status}")
    
    log_lines = []
    log_lines.append(f"Job ID: {job.id}")
    log_lines.append(f"Job Status: {job.status}")
    log_lines.append(f"Region Count: {len(job.regions)}")

    for region in job.regions:
        sheet_name = region.sheet_name
        location = region.location
        region_id = region.region_id
        
        print(f"Processing region {region_id} on sheet {sheet_name} at {location}...")
        log_lines.append(f"Region: {region_id} sheet={sheet_name} location={location}")
        
        # Get Parquet download URL
        result_table = client.beta.sheets.get_result_table(
            region_type=region.region_type,
            spreadsheet_job_id=job.id,
            region_id=region_id
        )
        
        parquet_path = os.path.join(output_dir, f"region_{region_id}.parquet")
        print(f"Downloading Parquet to {parquet_path}...")
        
        response = requests.get(result_table.url, stream=True)
        response.raise_for_status()
        with open(parquet_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        log_lines.append(f"Parquet: {parquet_path}")

    log_path = os.path.join(output_dir, "sheets.log")
    with open(log_path, "w") as f:
        f.write("\n".join(log_lines) + "\n")
    
    print(f"Log written to {log_path}")

if __name__ == "__main__":
    main()
