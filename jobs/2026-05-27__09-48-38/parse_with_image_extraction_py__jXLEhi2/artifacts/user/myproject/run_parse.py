from __future__ import annotations

import os
from pathlib import Path
from urllib.request import urlopen
from io import BytesIO

from PIL import Image
from llama_cloud import LlamaCloud
from llama_cloud.types import parsing_create_params

INPUT_PDF = Path("/home/user/myproject/input.pdf")
OUTPUT_DIR = Path("/home/user/myproject/output")
IMAGES_DIR = OUTPUT_DIR / "images"
MARKDOWN_PATH = OUTPUT_DIR / "markdown.md"
LOG_PATH = OUTPUT_DIR / "output.log"

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def fetch_bytes(url: str) -> bytes:
    with urlopen(url) as response:
        return response.read()


def convert_to_png(image_bytes: bytes) -> bytes:
    with Image.open(BytesIO(image_bytes)) as image:
        output = BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()


def main() -> None:
    if not INPUT_PDF.exists():
        raise FileNotFoundError(f"Input PDF not found: {INPUT_PDF}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    client = LlamaCloud()

    with INPUT_PDF.open("rb") as handle:
        uploaded = client.files.create(file=handle, purpose="parse")

    output_options = parsing_create_params.OutputOptions(
        images_to_save=["screenshot"],
        markdown=parsing_create_params.OutputOptionsMarkdown(),
    )

    result = client.parsing.parse(
        tier="cost_effective",
        version="latest",
        file_id=uploaded.id,
        output_options=output_options,
        expand=["markdown", "images_content_metadata"],
    )

    markdown_pages = []
    if result.markdown is not None:
        for page in result.markdown.pages:
            if getattr(page, "success", False) and getattr(page, "markdown", None) is not None:
                markdown_pages.append(page.markdown)
            elif getattr(page, "success", False) is False:
                markdown_pages.append(f"<!-- Page {page.page_number} failed: {page.error} -->")

    markdown_text = "\n\n".join(markdown_pages)
    MARKDOWN_PATH.write_text(markdown_text, encoding="utf-8")

    screenshot_images = []
    if result.images_content_metadata is not None:
        for image in result.images_content_metadata.images:
            if image.category == "screenshot" and image.presigned_url:
                screenshot_images.append(image)

    screenshot_images.sort(key=lambda item: item.index)

    image_count = 0
    for page_index, image in enumerate(screenshot_images, start=1):
        image_bytes = fetch_bytes(image.presigned_url)
        if not image_bytes.startswith(PNG_MAGIC):
            image_bytes = convert_to_png(image_bytes)
        if not image_bytes.startswith(PNG_MAGIC):
            raise ValueError(f"Image {page_index} is not a valid PNG")
        image_path = IMAGES_DIR / f"page_{page_index}.png"
        image_path.write_bytes(image_bytes)
        image_count += 1

    markdown_chars = len(markdown_text)

    log_lines = [
        f"Parse job ID: {result.job.id}",
        f"Markdown chars: {markdown_chars}",
        f"Image count: {image_count}",
    ]
    LOG_PATH.write_text("\n".join(log_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
