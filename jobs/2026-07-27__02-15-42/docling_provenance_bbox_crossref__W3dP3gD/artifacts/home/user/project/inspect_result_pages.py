import docling
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")

print("result.pages is of type:", type(result.pages))
print("Number of pages in result.pages:", len(result.pages))
if len(result.pages) > 0:
    page = result.pages[0]
    print("Page 0 type:", type(page))
    for attr in dir(page):
        if not attr.startswith("_"):
            try:
                print(f"  {attr}: {type(getattr(page, attr))}")
            except Exception as e:
                print(f"  {attr}: error {e}")
