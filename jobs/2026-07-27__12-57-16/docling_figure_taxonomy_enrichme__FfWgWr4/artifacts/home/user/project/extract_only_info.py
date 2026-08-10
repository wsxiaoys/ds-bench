from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

pipeline_options = PdfPipelineOptions()
pipeline_options.do_picture_classification = True
pipeline_options.generate_page_images = True

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
    }
)

result = converter.convert("assets/report.pdf")
doc = result.document

for idx, pic in enumerate(doc.pictures):
    print(f"\n--- Picture {idx} ---")
    
    # 1. Class Label and Confidence
    if hasattr(pic, "meta") and pic.meta and getattr(pic.meta, "classification", None):
        predictions = pic.meta.classification.predictions
        if predictions:
            sorted_preds = sorted(predictions, key=lambda p: p.confidence, reverse=True)
            top_pred = sorted_preds[0]
            print(f"  Class label: {top_pred.class_name}")
            print(f"  Confidence: {top_pred.confidence}")
        else:
            print("  No predictions found in meta.classification")
    else:
        print("  No classification meta field")
        
    # 2. Page Number and Bounding Box
    if pic.prov:
        prov = pic.prov[0]
        print(f"  Page No: {prov.page_no}")
        print(f"  Bbox: {prov.bbox}")
        if hasattr(prov.bbox, "as_tuple"):
            print(f"    as_tuple: {prov.bbox.as_tuple()}")
            
        page_no = prov.page_no
        page = doc.pages[page_no]
        if page:
            print(f"    Page size: width={page.size.width}, height={page.size.height}")
    else:
        print("  No provenance found")
        
    # 3. Caption
    try:
        cap_text = pic.caption_text(doc)
        print(f"  Caption Text: {repr(cap_text)}")
    except Exception as e:
        print(f"  Caption Text failed: {e}")
