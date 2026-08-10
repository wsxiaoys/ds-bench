from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

pipeline_options = PdfPipelineOptions()
pipeline_options.generate_page_images = True
pipeline_options.generate_picture_images = True
pipeline_options.generate_table_images = True
pipeline_options.images_scale = 2.0

format_options = {
    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
}

converter = DocumentConverter(format_options=format_options)
result = converter.convert("assets/report.pdf")
doc = result.document

# Let's compare Picture 0
pic = doc.pictures[0]
pic_img = pic.get_image(doc)

# Get page height and page image
page_no = pic.prov[0].page_no
page_item = doc.pages[page_no]
H = page_item.size.height

# Get page image from result.pages
page_obj = [p for p in result.pages if p.page_no == page_no][0]
page_img = page_obj.get_image(scale=2.0)

# Bounding box in BOTTOMLEFT
bbox = pic.prov[0].bbox
# Convert to TOPLEFT
left = bbox.l
top = H - bbox.t
right = bbox.r
bottom = H - bbox.b

# Scale
scale = 2.0
x0 = left * scale
y0 = top * scale
x1 = right * scale
y1 = bottom * scale

manual_crop = page_img.crop((round(x0), round(y0), round(x1), round(y1)))

print("Pic image size:", pic_img.size)
print("Manual crop size:", manual_crop.size)
