import os
import json
import logging
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

# Set up logging to avoid cluttering stdout if not needed, but keep it informative
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def main():
    # 1. Define paths
    pdf_path = "assets/report.pdf"
    output_dir = Path("output")
    figures_dir = output_dir / "figures"
    
    # Ensure output directories exist
    figures_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Configure Docling pipeline options
    logger.info("Configuring Docling pipeline options...")
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_picture_classification = True
    pipeline_options.generate_page_images = True
    pipeline_options.generate_picture_images = True
    pipeline_options.images_scale = 2.0
    
    # Initialize DocumentConverter
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    
    # 3. Convert the PDF
    logger.info(f"Converting document: {pdf_path}")
    result = converter.convert(pdf_path)
    doc = result.document
    
    # 4. Extract figures and metadata
    logger.info("Extracting figures and compiling taxonomy report...")
    figures_data = {}
    figure_count = len(doc.pictures)
    
    # Grouping for markdown summary
    class_groups = {}
    
    for idx, pic in enumerate(doc.pictures):
        idx_str = str(idx)
        
        # A. Class label & Confidence
        class_label = "unknown"
        confidence = 0.0
        if hasattr(pic, "meta") and pic.meta and getattr(pic.meta, "classification", None):
            predictions = pic.meta.classification.predictions
            if predictions:
                # Sort predictions by confidence desc to get the top prediction
                sorted_preds = sorted(predictions, key=lambda p: p.confidence, reverse=True)
                top_pred = sorted_preds[0]
                class_label = top_pred.class_name
                confidence = float(top_pred.confidence)
        
        # B. Page number
        page_no = 1
        if pic.prov:
            page_no = int(pic.prov[0].page_no)
            
        # C. Bounding Box (normalized against page dimensions)
        bbox_dict = {"x0": 0.0, "y0": 0.0, "x1": 0.0, "y1": 0.0}
        if pic.prov:
            prov = pic.prov[0]
            bbox = prov.bbox
            page = doc.pages.get(page_no)
            if page:
                norm_bbox = bbox.normalized(page.size)
                # Bounding box must satisfy x0 < x1 and y0 < y1
                # Using BOTTOMLEFT coordinate origin
                bbox_dict = {
                    "x0": float(norm_bbox.l),
                    "y0": float(norm_bbox.b),
                    "x1": float(norm_bbox.r),
                    "y1": float(norm_bbox.t)
                }
                
                # Double-check constraints
                if bbox_dict["x0"] > bbox_dict["x1"]:
                    bbox_dict["x0"], bbox_dict["x1"] = bbox_dict["x1"], bbox_dict["x0"]
                if bbox_dict["y0"] > bbox_dict["y1"]:
                    bbox_dict["y0"], bbox_dict["y1"] = bbox_dict["y1"], bbox_dict["y0"]
                    
        # D. Caption text
        caption = ""
        try:
            caption = pic.caption_text(doc) or ""
        except Exception as e:
            logger.warning(f"Failed to extract caption for picture {idx}: {e}")
            
        # E. Save cropped image as PNG
        image_relative_path = f"output/figures/{idx}.png"
        image_absolute_path = figures_dir / f"{idx}.png"
        try:
            img = pic.get_image(doc)
            if img:
                img.save(image_absolute_path, "PNG")
                logger.info(f"Saved figure {idx} to {image_relative_path}")
            else:
                logger.error(f"Failed to get image for picture {idx}")
        except Exception as e:
            logger.error(f"Error saving image for picture {idx}: {e}")
            
        # F. Store in report dict
        figures_data[idx_str] = {
            "class_label": class_label,
            "confidence": confidence,
            "page_no": page_no,
            "bbox": bbox_dict,
            "caption": caption,
            "image_path": image_relative_path
        }
        
        # Grouping for summary
        if class_label not in class_groups:
            class_groups[class_label] = []
        class_groups[class_label].append(idx)
        
    # 5. Build JSON Taxonomy Report
    report = {
        "source_pdf": pdf_path,
        "figure_count": figure_count,
        "figures": figures_data
    }
    
    # Save JSON report
    json_report_path = output_dir / "taxonomy_report.json"
    with open(json_report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    logger.info(f"Taxonomy report saved to {json_report_path}")
    
    # 6. Build Human-Readable Markdown Summary
    markdown_lines = [
        "# Figure Taxonomy & Caption Cross-Reference Report",
        "",
        f"**Source PDF:** `{pdf_path}`",
        f"**Total Figures Detected:** {figure_count}",
        ""
    ]
    
    # Sort class labels to keep markdown deterministic and neat
    for label in sorted(class_groups.keys()):
        markdown_lines.append(f"## {label}")
        markdown_lines.append("")
        for fig_idx in class_groups[label]:
            fig_info = figures_data[str(fig_idx)]
            caption_str = f'"{fig_info["caption"]}"' if fig_info["caption"] else "No caption"
            markdown_lines.append(
                f"- **Figure {fig_idx}**"
            )
            markdown_lines.append(f"  - **Confidence:** {fig_info['confidence']:.4f}")
            markdown_lines.append(f"  - **Page:** {fig_info['page_no']}")
            markdown_lines.append(
                f"  - **Bounding Box:** `[x0={fig_info['bbox']['x0']:.4f}, y0={fig_info['bbox']['y0']:.4f}, x1={fig_info['bbox']['x1']:.4f}, y1={fig_info['bbox']['y1']:.4f}]`"
            )
            markdown_lines.append(f"  - **Caption:** {caption_str}")
            markdown_lines.append(f"  - **Image:** [{fig_info['image_path']}]({fig_info['image_path']})")
            markdown_lines.append("")
            
    # Save Markdown summary
    md_summary_path = output_dir / "taxonomy_summary.md"
    with open(md_summary_path, "w", encoding="utf-8") as f:
        f.write("\n".join(markdown_lines))
    logger.info(f"Taxonomy summary saved to {md_summary_path}")
    
    print("Taxonomy processing completed successfully!")

if __name__ == "__main__":
    main()
