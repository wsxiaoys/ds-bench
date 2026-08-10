from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

pipeline_options = PdfPipelineOptions()
pipeline_options.generate_page_images = True
pipeline_options.generate_picture_images = True
pipeline_options.generate_table_images = True
pipeline_options.images_scale = 3.5

format_options = {
    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
}

converter = DocumentConverter(format_options=format_options)
result = converter.convert("assets/report.pdf")
doc = result.document

page = result.pages[0]
print("page.get_image(scale=3.5) size:", page.get_image(scale=3.5).size)
