import os
import json
from PIL import Image, ImageDraw
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

def main():
    # 1. Define paths
    project_dir = os.path.dirname(os.path.abspath(__file__))
    input_pdf = os.path.join(project_dir, "assets", "report.pdf")
    output_dir = os.path.join(project_dir, "output")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # 2. Configure Docling
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_page_images = True
    pipeline_options.images_scale = 2.0
    
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options
            )
        }
    )
    
    # 3. Convert document
    print(f"Converting {input_pdf}...")
    result = converter.convert(input_pdf)
    doc = result.document
    
    # 4. Map element types to colors
    COLOR_MAP = {
        "text": "#1f77b4",
        "section_header": "#d62728",
        "list_item": "#2ca02c",
        "table": "#ff7f0e",
        "picture": "#9467bd",
        "caption": "#8c564b"
    }
    
    # 5. Process pages
    # Let's group document items by page_no
    items_by_page = {}
    for item, level in doc.iterate_items():
        item_type = str(item.label)
        if item_type not in COLOR_MAP:
            continue
        
        for prov_item in item.prov:
            page_no = prov_item.page_no
            if page_no not in items_by_page:
                items_by_page[page_no] = []
            items_by_page[page_no].append((item, prov_item))
            
    # Now write artifacts for each page
    for page in result.pages:
        page_no = page.page_no
        page_width = page.size.width
        page_height = page.size.height
        
        # Get page image
        img = page.image
        if img is None:
            print(f"Warning: Page {page_no} has no rendered image.")
            continue
            
        image_width, image_height = img.size
        
        # Create a copy of the image to draw on
        overlay_img = img.copy()
        draw = ImageDraw.Draw(overlay_img)
        
        # Scale factors to map page coordinates to pixel coordinates
        scale_x = image_width / page_width
        scale_y = image_height / page_height
        
        boxes_list = []
        
        # Get elements for this page
        page_items = items_by_page.get(page_no, [])
        for item, prov_item in page_items:
            item_type = str(item.label)
            color = COLOR_MAP[item_type]
            
            # Convert bounding box to top-left coordinate system
            bbox = prov_item.bbox
            tl_bbox = bbox.to_top_left_origin(page_height)
            
            # Scale coordinates to pixel space
            x0 = tl_bbox.l * scale_x
            y0 = tl_bbox.t * scale_y
            x1 = tl_bbox.r * scale_x
            y1 = tl_bbox.b * scale_y
            
            # Ensure coordinates are within image boundaries and x0 < x1, y0 < y1
            x0 = max(0.0, min(x0, float(image_width)))
            x1 = max(0.0, min(x1, float(image_width)))
            y0 = max(0.0, min(y0, float(image_height)))
            y1 = max(0.0, min(y1, float(image_height)))
            
            if x0 > x1:
                x0, x1 = x1, x0
            if y0 > y1:
                y0, y1 = y1, y0
                
            # If they are equal, make sure they are distinct
            if x0 == x1:
                x1 = min(float(image_width), x0 + 1.0)
                if x0 == x1:
                    x0 = max(0.0, x1 - 1.0)
            if y0 == y1:
                y1 = min(float(image_height), y0 + 1.0)
                if y0 == y1:
                    y0 = max(0.0, y1 - 1.0)
                
            # Draw rectangle
            draw.rectangle([x0, y0, x1, y1], outline=color, width=3)
            
            # Add to manifest
            boxes_list.append({
                "id": item.self_ref,
                "type": item_type,
                "bbox": [x0, y0, x1, y1],
                "color": color
            })
            
        # Save overlay image
        output_png_path = os.path.join(output_dir, f"overlay_page_{page_no}.png")
        overlay_img.save(output_png_path, "PNG")
        
        # Save manifest JSON
        manifest_data = {
            "page_no": page_no,
            "image_width": image_width,
            "image_height": image_height,
            "boxes": boxes_list
        }
        output_json_path = os.path.join(output_dir, f"overlay_page_{page_no}.json")
        with open(output_json_path, "w") as f:
            json.dump(manifest_data, f, indent=2)
            
        print(f"Generated overlay and manifest for page {page_no}.")

if __name__ == "__main__":
    main()
