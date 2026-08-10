import docling
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")

print("Type of result:", type(result))
doc = result.document
print("Type of result.document:", type(doc))

# Let's print the attributes of doc
print("Attributes of doc:")
for attr in dir(doc):
    if not attr.startswith("_"):
        print(f"  {attr}: {type(getattr(doc, attr))}")
