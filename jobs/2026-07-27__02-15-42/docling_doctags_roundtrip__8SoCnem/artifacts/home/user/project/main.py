import sys
import os
import json
from pathlib import Path

# Parse CLI arguments and validate
if len(sys.argv) < 2:
    print("Error: Missing input PDF path positional argument.", file=sys.stderr)
    sys.exit(2)

input_pdf_path = sys.argv[1]
if not os.path.exists(input_pdf_path):
    print(f"Error: File '{input_pdf_path}' does not exist.", file=sys.stderr)
    sys.exit(2)

try:
    from docling.document_converter import DocumentConverter
    from docling_core.types.doc.document import DoclingDocument
    from docling_core.types.doc.doctags import DocTagsDocument, DocTagsPage

    # 1. Convert PDF to DoclingDocument (original)
    converter = DocumentConverter()
    result = converter.convert(input_pdf_path)
    original_doc = result.document

    # 2. Serialize original document to DocTags representation
    doctags_str = original_doc.export_to_doctags()

    # Create out directory
    out_dir = Path("out")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Write original.doctags verbatim
    doctags_path = out_dir / "original.doctags"
    doctags_path.write_text(doctags_str, encoding="utf-8")

    # 3. Reconstruct a brand-new DoclingDocument by parsing the DocTags file back in
    # Read the written DocTags file verbatim
    saved_doctags_str = doctags_path.read_text(encoding="utf-8")
    
    # Construct DocTagsDocument
    doctags_doc = DocTagsDocument(pages=[DocTagsPage(tokens=saved_doctags_str)])
    
    # Reconstruct DoclingDocument from the DocTagsDocument
    reconstructed_doc = DoclingDocument.load_from_doctags(doctags_doc)

    # 4. Re-export reconstructed document to Markdown
    reconstructed_md = reconstructed_doc.export_to_markdown()
    md_path = out_dir / "reconstructed.md"
    md_path.write_text(reconstructed_md, encoding="utf-8")

    # 5. Emit JSON comparison report
    def get_metrics(doc):
        texts_count = len(doc.texts)
        tables_count = len(doc.tables)
        pictures_count = len(doc.pictures)
        
        headings_count = 0
        title_found = False
        for item in doc.texts:
            label_str = getattr(item.label, "value", str(item.label))
            if label_str == "section_header":
                if not title_found:
                    title_found = True
                    continue
                headings_count += 1
        return {
            "texts": texts_count,
            "tables": tables_count,
            "pictures": pictures_count,
            "headings": headings_count,
        }

    original_metrics = get_metrics(original_doc)
    reconstructed_metrics = get_metrics(reconstructed_doc)

    match_metrics = {
        "texts": original_metrics["texts"] == reconstructed_metrics["texts"],
        "tables": original_metrics["tables"] == reconstructed_metrics["tables"],
        "pictures": original_metrics["pictures"] == reconstructed_metrics["pictures"],
        "headings": original_metrics["headings"] == reconstructed_metrics["headings"],
    }

    equivalent = all(match_metrics.values())

    comparison_report = {
        "original": original_metrics,
        "reconstructed": reconstructed_metrics,
        "match": match_metrics,
        "equivalent": equivalent,
    }

    report_path = out_dir / "comparison_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(comparison_report, f, indent=2)

    sys.exit(0)

except Exception as e:
    # Print clean error message without a traceback
    print(f"Error during execution: {e}", file=sys.stderr)
    sys.exit(1)
