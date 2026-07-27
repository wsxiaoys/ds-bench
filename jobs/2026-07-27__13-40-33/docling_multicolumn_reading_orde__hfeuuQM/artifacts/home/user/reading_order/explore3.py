import os, json
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

artifacts = os.environ.get("DOCLING_ARTIFACTS_PATH")
pdf_opts = PdfPipelineOptions(
    artifacts_path=artifacts,
    do_ocr=False, do_table_structure=False,
    generate_page_images=False, generate_picture_images=False,
)
converter = DocumentConverter(
    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)}
)
result = converter.convert("assets/report.pdf")
doc = result.document

for pno, p in doc.pages.items():
    print("PAGE", pno, "size", p.size.width, p.size.height)

print("---- text6 (multi-prov) ----")
t6 = doc.texts[6]
print("ref", t6.self_ref, "label", t6.label)
for pr in t6.prov:
    bb = pr.bbox
    print("  raw BOTTOMLEFT l=%.3f t=%.3f r=%.3f b=%.3f origin=%s" % (bb.l, bb.t, bb.r, bb.b, bb.coord_origin))
    tl = bb.to_top_left_origin(792.0)
    print("  topleft l=%.3f t=%.3f r=%.3f b=%.3f" % (tl.l, tl.t, tl.r, tl.b))
print("  text:", repr(t6.text[:80]))

# Dump all elements with precise top-left bboxes and labels
print("==== ALL ELEMENTS (top-left) ====")
for i, t in enumerate(doc.texts):
    prs = []
    for pr in t.prov:
        tl = pr.bbox.to_top_left_origin(792.0)
        prs.append((pr.page_no, round(tl.l,2), round(tl.t,2), round(tl.r,2), round(tl.b,2)))
    print(i, t.self_ref, t.label, prs)