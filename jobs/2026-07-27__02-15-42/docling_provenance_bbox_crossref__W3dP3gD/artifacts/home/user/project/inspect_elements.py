import docling
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")
doc = result.document

print(f"Number of pictures: {len(doc.pictures)}")
if len(doc.pictures) > 0:
    pic = doc.pictures[0]
    print("Picture 0:")
    print("  Type:", type(pic))
    for attr in dir(pic):
        if not attr.startswith("_"):
            try:
                val = getattr(pic, attr)
                print(f"    {attr}: {type(val)}")
            except Exception as e:
                print(f"    {attr}: error {e}")

print(f"Number of tables: {len(doc.tables)}")
if len(doc.tables) > 0:
    tbl = doc.tables[0]
    print("Table 0:")
    print("  Type:", type(tbl))
    for attr in dir(tbl):
        if not attr.startswith("_"):
            try:
                val = getattr(tbl, attr)
                print(f"    {attr}: {type(val)}")
            except Exception as e:
                print(f"    {attr}: error {e}")
