import json, os, sys
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

artifacts = os.environ.get("DOCLING_ARTIFACTS_PATH")
print("artifacts:", artifacts)

pdf_opts = PdfPipelineOptions(
    artifacts_path=artifacts,
    do_ocr=False,
    do_table_structure=False,
    generate_page_images=False,
    generate_picture_images=False,
)

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)
    }
)

result = converter.convert("assets/report.pdf")
doc = result.document

print("type doc:", type(doc))
print("num pages:", len(doc.pages) if hasattr(doc, "pages") else "?")

print("=== texts ===")
for i, t in enumerate(doc.texts):
    print(i, "ref=", t.self_ref, "label=", t.label, "prov=", t.prov)

print("=== pages ===")
for pno, p in doc.pages.items():
    print("page", pno, "size=", p.size)