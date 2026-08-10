import docling
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")
doc = result.document

# Let's see how pages are represented
print("Pages in doc.pages:")
for page_no, page in doc.pages.items():
    print(f"Page {page_no}: type={type(page)}")
    for attr in dir(page):
        if not attr.startswith("_"):
            print(f"  {attr}: {getattr(page, attr)}")
    break
