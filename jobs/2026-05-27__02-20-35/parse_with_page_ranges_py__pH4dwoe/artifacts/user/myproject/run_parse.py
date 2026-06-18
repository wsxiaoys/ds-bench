import os
from pathlib import Path

from llama_cloud import LlamaCloud

INPUT_PDF = Path("/home/user/myproject/input/sample.pdf")
OUTPUT_DIR = Path("/home/user/myproject/output")
LOG_PATH = Path("/home/user/myproject/output.log")


def main() -> None:
    if not os.environ.get("LLAMA_CLOUD_API_KEY"):
        raise EnvironmentError("LLAMA_CLOUD_API_KEY is not set")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    client = LlamaCloud()

    with INPUT_PDF.open("rb") as file_handle:
        uploaded_file = client.files.create(file=file_handle, purpose="parse")

    result = client.parsing.parse(
        file_id=uploaded_file.id,
        tier="cost_effective",
        version="latest",
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"],
    )

    pages = result.markdown.pages
    for page in pages:
        page_number = page.page_number
        page_path = OUTPUT_DIR / f"page_{page_number}.md"
        with page_path.open("w", encoding="utf-8") as page_file:
            page_file.write(page.markdown)

    with LOG_PATH.open("w", encoding="utf-8") as log_file:
        log_file.write(f"Job ID: {result.job.id}\n")
        log_file.write(f"Pages parsed: {len(pages)}\n")


if __name__ == "__main__":
    main()
