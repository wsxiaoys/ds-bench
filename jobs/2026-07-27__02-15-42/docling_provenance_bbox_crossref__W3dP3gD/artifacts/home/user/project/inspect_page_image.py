import docling
from docling.document_converter import DocumentConverter
import inspect

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")

page = result.pages[0]
print("page.get_image signature:", inspect.signature(page.get_image))

# Let's try calling page.get_image()
img = page.get_image()
print("page.get_image() returned:", type(img))
if img:
    print("Image size:", img.size)
