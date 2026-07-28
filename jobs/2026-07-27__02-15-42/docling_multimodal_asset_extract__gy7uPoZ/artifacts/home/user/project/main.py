import os
import shutil
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc.base import ImageRefMode

def main():
    # 1. Prepare output directory
    output_dir = "output"
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    # 2. Configure pipeline options for 2x scale page/picture rendering
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_page_images = True
    pipeline_options.generate_picture_images = True
    pipeline_options.images_scale = 2.0

    # 3. Initialize converter
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    # 4. Convert document
    pdf_path = "assets/report.pdf"
    result = converter.convert(pdf_path)
    doc = result.document

    # 5. Export tables
    for idx, table in enumerate(doc.tables, start=1):
        # Export to CSV
        df = table.export_to_dataframe(doc)
        csv_path = os.path.join(output_dir, f"table_{idx}.csv")
        df.to_csv(csv_path, index=False)
        print(f"Saved table to {csv_path}")

        # Export to HTML
        html_content = table.export_to_html(doc)
        html_path = os.path.join(output_dir, f"table_{idx}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Saved table HTML to {html_path}")

    # 6. Export pictures and update their URIs for Markdown reference
    for idx, picture in enumerate(doc.pictures, start=1):
        img = picture.get_image(doc)
        if img:
            picture_filename = f"picture_{idx}.png"
            picture_path = os.path.join(output_dir, picture_filename)
            img.save(picture_path)
            print(f"Saved picture to {picture_path}")
            
            # Update URI to relative filename for standard Markdown reference
            picture.image.uri = picture_filename
        else:
            print(f"Warning: No image found for picture {idx}")

    # 7. Render pages at 2x scale
    for page in result.pages:
        if page.image:
            page_path = os.path.join(output_dir, f"page_{page.page_no}.png")
            page.image.save(page_path)
            print(f"Saved page {page.page_no} to {page_path}")
        else:
            print(f"Warning: No image found for page {page.page_no}")

    # 8. Export document to Markdown with referenced images
    markdown_content = doc.export_to_markdown(image_mode=ImageRefMode.REFERENCED)
    markdown_path = os.path.join(output_dir, "document.md")
    with open(markdown_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
    print(f"Saved document Markdown to {markdown_path}")

if __name__ == "__main__":
    main()
