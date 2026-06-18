import json
import os
from pathlib import Path

from pydantic import BaseModel
from llama_cloud import LlamaCloud


class Invoice(BaseModel):
    vendor: str
    invoice_number: str
    total_amount: float
    line_items: list[str]


def extract_first_page_markdown(job) -> str:
    if hasattr(job, "markdown") and job.markdown and job.markdown.pages:
        first_page = job.markdown.pages[0]
        if hasattr(first_page, "markdown") and first_page.markdown:
            return first_page.markdown

    candidates = []
    if hasattr(job, "parse_result") and job.parse_result:
        candidates.append(job.parse_result)
    if hasattr(job, "result") and job.result:
        candidates.append(job.result)
    if hasattr(job, "output") and job.output:
        candidates.append(job.output)

    for candidate in candidates:
        if isinstance(candidate, dict):
            markdown = candidate.get("markdown")
            if isinstance(markdown, str) and markdown.strip():
                return markdown
            pages = candidate.get("pages")
            if isinstance(pages, list) and pages:
                page = pages[0]
                if isinstance(page, dict):
                    page_markdown = page.get("markdown")
                    if isinstance(page_markdown, str) and page_markdown.strip():
                        return page_markdown
                    page_text = page.get("text")
                    if isinstance(page_text, str) and page_text.strip():
                        return page_text
        if isinstance(candidate, list) and candidate:
            page = candidate[0]
            if isinstance(page, dict):
                page_markdown = page.get("markdown")
                if isinstance(page_markdown, str) and page_markdown.strip():
                    return page_markdown
                page_text = page.get("text")
                if isinstance(page_text, str) and page_text.strip():
                    return page_text
            if isinstance(page, str) and page.strip():
                return page

    raise ValueError("Unable to locate markdown output on parse job result.")


def main() -> None:
    api_key = os.environ["LLAMA_CLOUD_API_KEY"]
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()

    client = LlamaCloud(api_key=api_key)

    project_root = Path(__file__).resolve().parent
    file_path = project_root / "data" / "invoice.pdf"

    external_file_id = "invoice"
    if run_id:
        external_file_id = f"invoice-{run_id}"

    with file_path.open("rb") as handle:
        uploaded_file = client.files.create(
            file=handle,
            purpose="parse",
            external_file_id=external_file_id,
        )

    parse_job = client.parsing.create(
        file_id=uploaded_file.id,
        tier="agentic",
        version="latest",
        output_options={"markdown": {}},
    )
    parse_job = client.parsing.wait_for_completion(parse_job.id)
    parse_result = client.parsing.get(parse_job.id, expand=["markdown"])

    markdown = extract_first_page_markdown(parse_result)
    parsed_path = project_root / "parsed.md"
    parsed_path.write_text(markdown, encoding="utf-8")

    schema = Invoice.model_json_schema()

    extract_job = client.extract.create(
        file_input=parse_job.id,
        configuration={
            "data_schema": schema,
            "tier": "agentic",
        },
    )
    extract_job = client.extract.wait_for_completion(extract_job.id)

    extracted_path = project_root / "extracted.json"
    with extracted_path.open("w", encoding="utf-8") as handle:
        json.dump(extract_job.extract_result, handle, indent=2)

    log_path = project_root / "output.log"
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"Parse Job ID: {parse_job.id}\n")
        handle.write(f"Extract Job ID: {extract_job.id}\n")


if __name__ == "__main__":
    main()
