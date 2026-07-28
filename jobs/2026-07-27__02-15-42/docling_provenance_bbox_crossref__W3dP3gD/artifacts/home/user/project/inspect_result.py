import docling
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")

print("Attributes of result:")
for attr in dir(result):
    if not attr.startswith("_"):
        print(f"  {attr}: {type(getattr(result, attr))}")
