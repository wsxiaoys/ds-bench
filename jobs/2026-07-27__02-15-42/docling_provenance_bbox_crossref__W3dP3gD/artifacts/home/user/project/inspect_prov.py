import docling
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("assets/report.pdf")
doc = result.document

print("--- PICTURES ---")
for idx, pic in enumerate(doc.pictures):
    print(f"Picture {idx}:")
    print("  caption_text():", repr(pic.caption_text(doc)))
    print("  captions:", pic.captions)
    print("  prov:", pic.prov)
    if len(pic.prov) > 0:
        p = pic.prov[0]
        print("    prov[0] type:", type(p))
        print("    prov[0] dir:", [a for a in dir(p) if not a.startswith("_")])
        print("    prov[0] bbox:", getattr(p, "bbox", None))
        print("    prov[0] page_no:", getattr(p, "page_no", None))
    # Let's inspect get_image signature or docs
    import inspect
    print("  get_image signature:", inspect.signature(pic.get_image))

print("--- TABLES ---")
for idx, tbl in enumerate(doc.tables):
    print(f"Table {idx}:")
    print("  caption_text():", repr(tbl.caption_text(doc)))
    print("  captions:", tbl.captions)
    print("  prov:", tbl.prov)
    if len(tbl.prov) > 0:
        p = tbl.prov[0]
        print("    prov[0] bbox:", getattr(p, "bbox", None))
        print("    prov[0] page_no:", getattr(p, "page_no", None))
