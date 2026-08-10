from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

pipeline_options = PdfPipelineOptions()
pipeline_options.generate_page_images = True
pipeline_options.generate_picture_images = True
pipeline_options.generate_table_images = True
pipeline_options.images_scale = 2.0  # arbitrary scale for testing

format_options = {
    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
}

converter = DocumentConverter(format_options=format_options)
result = converter.convert("assets/report.pdf")
doc = result.document

print("Number of pages in result.pages:", len(result.pages))
for page in result.pages:
    img = page.get_image()
    print(f"Page {page.page_no} image: {type(img)}")
    if img:
        print(f"  Page {page.page_no} image size: {img.size}")

print("Number of pictures in doc.pictures:", len(doc.pictures))
for idx, pic in enumerate(doc.pictures):
    img = pic.get_image(doc)
    print(f"Picture {idx} image: {type(img)}")
    if img:
        print(f"  Picture {idx} image size: {img.size}")

print("Number of tables in doc.tables:", len(doc.tables))
for idx, tbl in enumerate(doc.tables):
    img = tbl.get_image(doc)
    print(f"Table {idx} image: {type(img)}")
    if img:
        print(f"  Table {idx} image size: {img.size}")
