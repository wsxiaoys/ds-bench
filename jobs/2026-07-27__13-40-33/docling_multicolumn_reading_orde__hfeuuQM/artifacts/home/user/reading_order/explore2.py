import os
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

artifacts = os.environ.get("DOCLING_ARTIFACTS_PATH")
pdf_opts = PdfPipelineOptions(
    artifacts_path=artifacts,
    do_ocr=False,
    do_table_structure=False,
    generate_page_images=False,
    generate_picture_images=False,
)
converter = DocumentConverter(
    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)}
)
result = converter.convert("assets/report.pdf")
doc = result.document

PAGE_H = 792.0
for i, t in enumerate(doc.texts):
    provs = []
    for pr in t.prov:
        bb = pr.bbox.to_top_left_origin(PAGE_H)
        provs.append((pr.page_no, round(bb.l,1), round(bb.t,1), round(bb.r,1), round(bb.b,1)))
    txt = t.text.replace("\n", " ")
    print(f"{i} ref={t.self_ref} label={t.label} prov={provs}")
    print(f"    TEXT: {txt[:120]!r}")
print("=== pages ===")
for pno, p in doc.pages.items():
    print("page", pno, "size=", p.size)