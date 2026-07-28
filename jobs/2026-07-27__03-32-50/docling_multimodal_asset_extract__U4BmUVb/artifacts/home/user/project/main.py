"""
Multimodal asset extraction from a PDF using Docling.

Converts assets/report.pdf into Docling's document model and exports:
  - output/table_<n>.csv / .html    for every table
  - output/picture_<n>.png          cropped figure images
  - output/page_<n>.png             full-page renders at 2x scale (~144 DPI)
  - output/document.md              markdown with externally-referenced images
"""

from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import ImageRefMode, PictureItem, TableItem

PROJECT_DIR = Path(__file__).resolve().parent
INPUT_PDF = PROJECT_DIR / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"

IMAGE_SCALE = 2.0  # ~144 DPI (72 DPI * 2)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Configure the PDF pipeline so that page images, picture images, and
    # table cell images are all generated at 2x scale (~144 DPI) and kept
    # attached to the document for later export. All models used here are
    # the default, offline, pre-baked Docling models.
    pipeline_options = PdfPipelineOptions()
    pipeline_options.images_scale = IMAGE_SCALE
    pipeline_options.generate_page_images = True
    pipeline_options.generate_picture_images = True
    pipeline_options.generate_table_images = True

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )

    result = converter.convert(str(INPUT_PDF))
    doc = result.document

    # --- Tables: export both CSV and HTML for every table, in reading order ---
    table_items = [item for item in doc.tables]
    for idx, table in enumerate(table_items, start=1):
        df = table.export_to_dataframe(doc=doc)
        csv_path = OUTPUT_DIR / f"table_{idx}.csv"
        df.to_csv(csv_path, index=False)

        html_str = table.export_to_html(doc=doc)
        html_path = OUTPUT_DIR / f"table_{idx}.html"
        html_path.write_text(html_str, encoding="utf-8")

    # --- Pictures: export cropped raster image for every figure, in reading order ---
    picture_items = [item for item in doc.pictures]
    for idx, picture in enumerate(picture_items, start=1):
        image = picture.get_image(doc)
        if image is not None:
            png_path = OUTPUT_DIR / f"picture_{idx}.png"
            image.save(png_path, format="PNG")

    # --- Pages: export full-page renders at 2x scale (~144 DPI) ---
    for page_no, page in doc.pages.items():
        if page.image is not None:
            image = page.image.pil_image
            png_path = OUTPUT_DIR / f"page_{page_no}.png"
            image.save(png_path, format="PNG")

    # --- Markdown: externally referenced images (no inline base64 data URIs) ---
    # Using a relative artifacts_dir keeps the image references in the
    # generated Markdown as relative paths (e.g. "document_artifacts/xxx.png")
    # instead of absolute filesystem paths.
    md_path = OUTPUT_DIR / "document.md"
    doc.save_as_markdown(
        filename=md_path,
        artifacts_dir=Path("document_artifacts"),
        image_mode=ImageRefMode.REFERENCED,
    )

    print(f"Converted {INPUT_PDF} -> {OUTPUT_DIR}")
    print(f"  tables:   {len(table_items)}")
    print(f"  pictures: {len(picture_items)}")
    print(f"  pages:    {len(doc.pages)}")


if __name__ == "__main__":
    main()
