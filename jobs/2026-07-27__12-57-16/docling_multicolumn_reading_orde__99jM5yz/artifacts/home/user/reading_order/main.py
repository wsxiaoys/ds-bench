import json
from pathlib import Path
from docling.document_converter import DocumentConverter

def main():
    pdf_path = Path("assets/report.pdf")
    if not pdf_path.exists():
        raise FileNotFoundError(f"Input PDF not found at {pdf_path}")

    print("Converting document...")
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    doc = result.document

    # Get page dimensions
    page_heights = {}
    page_widths = {}
    for page_no, page_obj in doc.pages.items():
        page_heights[page_no] = page_obj.size.height
        page_widths[page_no] = page_obj.size.width

    # Group and filter kept elements by page
    elements_by_page = {}
    for item, level in doc.iterate_items():
        label = getattr(item, 'label', 'N/A')
        if label in ('page_header', 'page_footer'):
            continue
        prov = getattr(item, 'prov', [])
        if not prov:
            continue
        page_no = prov[0].page_no
        if page_no not in elements_by_page:
            elements_by_page[page_no] = []
        elements_by_page[page_no].append(item)

    pages_list = []

    # Process each page
    for page_no in sorted(doc.pages.keys()):
        H = page_heights[page_no]
        W = page_widths[page_no]
        items = elements_by_page.get(page_no, [])

        if not items:
            pages_list.append({
                "page_no": page_no,
                "column_count": 1,
                "elements": []
            })
            continue

        item_data = []
        for item in items:
            p = item.prov[0]
            l_bl, t_bl, r_bl, b_bl = p.bbox.l, p.bbox.t, p.bbox.r, p.bbox.b
            
            # Convert bottom-left to top-left
            l_tl = l_bl
            r_tl = r_bl
            t_tl = H - t_bl
            b_tl = H - b_bl
            
            # Clamp to page dimensions
            l_tl = max(0.0, min(l_tl, W))
            r_tl = max(0.0, min(r_tl, W))
            t_tl = max(0.0, min(t_tl, H))
            b_tl = max(0.0, min(b_tl, H))
            if l_tl >= r_tl:
                r_tl = l_tl + 1e-3
            if t_tl >= b_tl:
                b_tl = t_tl + 1e-3
                
            width = r_tl - l_tl
            center = (l_tl + r_tl) / 2
            
            item_data.append({
                "item": item,
                "bbox": [l_tl, t_tl, r_tl, b_tl],
                "width": width,
                "center": center,
                "top": t_tl
            })

        # Check if page is single column or multi-column
        narrow_items = [d for d in item_data if d["width"] < 300.0]
        
        if not narrow_items:
            # Single-column page
            column_count = 1
            sorted_items = sorted(item_data, key=lambda d: d["top"])
            elements_out = []
            for d in sorted_items:
                elements_out.append({
                    "id": d["item"].self_ref,
                    "column": 0,
                    "bbox": d["bbox"]
                })
        else:
            # Multi-column page
            narrow_centers = sorted([d["center"] for d in narrow_items])
            
            clusters = []
            for c in narrow_centers:
                if not clusters:
                    clusters.append([c])
                else:
                    if abs(c - clusters[-1][-1]) < 50.0:
                        clusters[-1].append(c)
                    else:
                        clusters.append([c])
                        
            cluster_centers = [sum(cluster) / len(cluster) for cluster in clusters]
            cluster_centers = sorted(cluster_centers)
            column_count = len(cluster_centers)
            
            spanning_items = []
            col_items = {i: [] for i in range(column_count)}
            
            for d in item_data:
                if d["width"] >= 300.0:
                    spanning_items.append(d)
                else:
                    closest_col_idx = min(
                        range(column_count),
                        key=lambda i: abs(d["center"] - cluster_centers[i])
                    )
                    col_items[closest_col_idx].append(d)
                    
            spanning_items = sorted(spanning_items, key=lambda d: d["top"])
            for i in range(column_count):
                col_items[i] = sorted(col_items[i], key=lambda d: d["top"])
                
            elements_out = []
            for d in spanning_items:
                elements_out.append({
                    "id": d["item"].self_ref,
                    "column": 0,
                    "bbox": d["bbox"]
                })
            for i in range(column_count):
                for d in col_items[i]:
                    elements_out.append({
                        "id": d["item"].self_ref,
                        "column": i,
                        "bbox": d["bbox"]
                    })
                    
        pages_list.append({
            "page_no": page_no,
            "column_count": column_count,
            "elements": elements_out
        })

    # Write outputs
    output_dir = Path("output")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write pages.json
    pages_json_path = output_dir / "pages.json"
    with open(pages_json_path, "w", encoding="utf-8") as f:
        json.dump({"pages": pages_list}, f, indent=2, ensure_ascii=False)
    print(f"Wrote {pages_json_path}")

    # Write reading_order.txt
    reading_order_txt_path = output_dir / "reading_order.txt"
    
    ref_to_text = {t.self_ref: getattr(t, "text", "") for t in doc.texts}

    all_texts = []
    for page in pages_list:
        for elem in page["elements"]:
            elem_id = elem["id"]
            all_texts.append(ref_to_text[elem_id])

    with open(reading_order_txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(all_texts))
    print(f"Wrote {reading_order_txt_path}")

if __name__ == "__main__":
    main()
