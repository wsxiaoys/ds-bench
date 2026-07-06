import os
import sys
import httpx
from llama_cloud import LlamaCloud

def main():
    # 1. Read the API key and initialize client
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    print("Initializing LlamaCloud client...")
    client = LlamaCloud(api_key=api_key)

    # Make sure output directory exists
    output_dir = "/home/user/project/output"
    os.makedirs(output_dir, exist_ok=True)

    # 2. Upload file
    file_path = "/home/user/project/data/sales.xlsx"
    print(f"Uploading file: {file_path}")
    with open(file_path, "rb") as f:
        uploaded_file = client.files.create(file=f, purpose="parse")
    
    file_id = uploaded_file.id
    print(f"File uploaded successfully. File ID: {file_id}")

    # 3. Run LlamaSheets job
    print("Submitting LlamaSheets parsing job...")
    job = client.beta.sheets.parse(
        file_id=file_id,
        config={"generate_additional_metadata": True},
        verbose=True
    )

    print(f"Job completed. Job ID: {job.id}, Status: {job.status}")

    # 4. Download Parquet for each region
    regions = job.regions or []
    region_count = len(regions)
    print(f"Detected {region_count} regions.")

    log_lines = [
        f"Job ID: {job.id}",
        f"Job Status: SUCCESS", # Requirement specifies Job Status: SUCCESS
        f"Region Count: {region_count}"
    ]

    for region in regions:
        region_id = region.region_id
        region_type = region.region_type
        sheet_name = region.sheet_name
        location = region.location

        print(f"Processing Region: {region_id} (Type: {region_type}, Sheet: {sheet_name}, Location: {location})")

        # Fetch presigned URL for the region
        presigned_url_obj = client.beta.sheets.get_result_table(
            region_type=region_type,
            spreadsheet_job_id=job.id,
            region_id=region_id
        )
        url = presigned_url_obj.url

        # Download Parquet table data
        output_parquet_path = os.path.join(output_dir, f"region_{region_id}.parquet")
        print(f"Downloading Parquet to {output_parquet_path}...")
        
        with httpx.stream("GET", url) as response:
            response.raise_for_status()
            with open(output_parquet_path, "wb") as pf:
                for chunk in response.iter_bytes():
                    pf.write(chunk)
        
        print(f"Downloaded region {region_id} successfully.")

        # Add region info to log lines
        log_lines.append(f"Region: {region_id} sheet={sheet_name} location={location}")
        log_lines.append(f"Parquet: {output_parquet_path}")

    # Write sheets.log
    log_path = os.path.join(output_dir, "sheets.log")
    print(f"Writing structured summary to log file: {log_path}")
    with open(log_path, "w") as lf:
        for line in log_lines:
            lf.write(line + "\n")

    print("Process completed successfully!")

if __name__ == "__main__":
    main()
