#!/usr/bin/env python3
"""Reconstruct multi-column human reading order from layout provenance."""

import json
import os
from collections import defaultdict

from docling.document_converter import DocumentConverter


def convert_bbox_to_topleft(bbox, page_height):
    """Convert a BoundingBox from BOTTOMLEFT origin to top-left origin.

    In BOTTOMLEFT coordinates, t > b (t is higher number = further from origin).
    In top-left coordinates, t < b (t is smaller number = closer to top).
    """
    return [
        bbox.l,
        page_height - bbox.t,
        bbox.r,
        page_height - bbox.b,
    ]


def is_furniture(item):
    """Check if an item is page furniture (header, footer, page number)."""
    return (
        item.content_layer.name == "FURNITURE"
        or item.label == "page_header"
        or item.label == "page_footer"
    )


def element_width(bbox):
    """Return the width of a bounding box."""
    return bbox[2] - bbox[0]


def is_spanning(bbox, page_width):
    """Check if a single bbox spans most of the page width (full-width element)."""
    return element_width(bbox) > page_width * 0.65


def detect_columns(body_elements, page_width):
    """Detect the number of body text columns on a page.

    Uses the x-coordinates of non-spanning body elements to cluster into columns.
    Returns (column_count, column_boundaries).
    """
    if not body_elements:
        return 1, []

    # Gather x-centers of non-spanning elements
    x_centers = []
    for elem in body_elements:
        bbox = elem["bbox"]
        if is_spanning(bbox, page_width):
            continue
        cx = (bbox[0] + bbox[2]) / 2.0
        x_centers.append(cx)

    if len(x_centers) < 2:
        return 1, []

    # Sort unique x-centers
    x_centers_sorted = sorted(set(x_centers))

    # Cluster x-centers that are close together (< 50pt gap)
    clusters = []
    current_cluster = [x_centers_sorted[0]]
    for cx in x_centers_sorted[1:]:
        if cx - current_cluster[-1] < 50:
            current_cluster.append(cx)
        else:
            clusters.append(current_cluster)
            current_cluster = [cx]
    clusters.append(current_cluster)

    if len(clusters) < 2:
        return 1, []

    # For each cluster, compute the min/max x bounds from actual elements
    column_boundaries = []
    for cluster in clusters:
        cluster_center = sum(cluster) / len(cluster)
        cluster_elements = [
            e
            for e in body_elements
            if not is_spanning(e["bbox"], page_width)
            and abs((e["bbox"][0] + e["bbox"][2]) / 2.0 - cluster_center) < 50
        ]
        if not cluster_elements:
            continue
        min_l = min(e["bbox"][0] for e in cluster_elements)
        max_r = max(e["bbox"][2] for e in cluster_elements)
        column_boundaries.append((min_l, max_r, cluster_center))

    # Sort columns left to right
    column_boundaries.sort(key=lambda c: c[2])

    if len(column_boundaries) < 2:
        return 1, []

    return len(column_boundaries), [(c[0], c[1]) for c in column_boundaries]


def assign_to_column(bbox, column_boundaries, page_width):
    """Assign a bbox to a column index (0-based).

    Full-width spanning elements -> column 0.
    Otherwise, assign to the column whose x-center is closest.
    """
    if is_spanning(bbox, page_width):
        return 0

    elem_cx = (bbox[0] + bbox[2]) / 2.0

    best_col = 0
    best_dist = float("inf")
    for i, (col_l, col_r) in enumerate(column_boundaries):
        col_cx = (col_l + col_r) / 2.0
        dist = abs(elem_cx - col_cx)
        if dist < best_dist:
            best_dist = dist
            best_col = i

    return best_col


def process_document(pdf_path):
    """Parse the PDF and return pages_data, text_map, and doc for validation."""
    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    doc = result.document

    # Build text map
    text_map = {}
    for item in doc.texts:
        text_map[item.self_ref] = item.text

    pages_data = []

    for page_no in sorted(doc.pages.keys()):
        page = doc.pages[page_no]
        page_width = page.size.width
        page_height = page.size.height

        # Collect body text elements for this page.
        # For items with multiple prov entries on the same page,
        # each prov entry becomes a separate element.
        body_elements = []

        for item in doc.texts:
            if is_furniture(item):
                continue

            page_provs = [p for p in item.prov if p.page_no == page_no]
            if not page_provs:
                continue

            for prov in page_provs:
                bbox_tl = convert_bbox_to_topleft(prov.bbox, page_height)
                body_elements.append({
                    "id": item.self_ref,
                    "bbox": bbox_tl,
                    "text": item.text,
                })

        if not body_elements:
            pages_data.append({
                "page_no": page_no,
                "column_count": 1,
                "elements": [],
            })
            continue

        # Detect columns from non-spanning elements
        column_count, column_boundaries = detect_columns(body_elements, page_width)

        # Assign each element to a column
        for elem in body_elements:
            elem["column"] = assign_to_column(
                elem["bbox"], column_boundaries, page_width
            )

        # Separate spanning from columnar elements
        spanning = [e for e in body_elements if is_spanning(e["bbox"], page_width)]
        columnar = [e for e in body_elements if not is_spanning(e["bbox"], page_width)]

        # Sort spanning elements top-to-bottom
        spanning.sort(key=lambda e: e["bbox"][1])

        # Group columnar elements by column, sort top-to-bottom within each
        col_groups = defaultdict(list)
        for e in columnar:
            col_groups[e["column"]].append(e)

        for col_idx in col_groups:
            col_groups[col_idx].sort(key=lambda e: e["bbox"][1])

        # Build reading order: spanning first, then columns left-to-right
        ordered_elements = []
        for e in spanning:
            ordered_elements.append({
                "id": e["id"],
                "column": 0,
                "bbox": e["bbox"],
            })

        for col_idx in sorted(col_groups.keys()):
            for e in col_groups[col_idx]:
                ordered_elements.append({
                    "id": e["id"],
                    "column": col_idx,
                    "bbox": e["bbox"],
                })

        pages_data.append({
            "page_no": page_no,
            "column_count": column_count,
            "elements": ordered_elements,
        })

    return pages_data, text_map, doc


def validate(pages_data, doc):
    """Validate bboxes and ordering invariants."""
    for page_entry in pages_data:
        page_no = page_entry["page_no"]
        page = doc.pages[page_no]
        pw = page.size.width
        ph = page.size.height

        for elem in page_entry["elements"]:
            l, t, r, b = elem["bbox"]
            assert l >= -1, f"bbox left {l} < 0 on page {page_no}"
            assert t >= -1, f"bbox top {t} < 0 on page {page_no}"
            assert r <= pw + 1, f"bbox right {r} > {pw} on page {page_no}"
            assert b <= ph + 1, f"bbox bottom {b} > {ph} on page {page_no}"
            assert l < r, f"bbox l >= r on page {page_no}: {elem['bbox']}"
            assert t < b, f"bbox t >= b on page {page_no}: {elem['bbox']}"

        # Column values must be non-decreasing
        elements = page_entry["elements"]
        prev_col = -1
        for elem in elements:
            assert elem["column"] >= prev_col, (
                f"Column order violation on page {page_no}: "
                f"{elem['column']} < {prev_col}"
            )
            prev_col = elem["column"]

        # Within each column, elements must be ordered by increasing top
        col_groups = defaultdict(list)
        for elem in elements:
            col_groups[elem["column"]].append(elem)

        for col_idx, col_elems in col_groups.items():
            for i in range(1, len(col_elems)):
                assert col_elems[i]["bbox"][1] >= col_elems[i - 1]["bbox"][1], (
                    f"Top order violation on page {page_no}, col {col_idx}: "
                    f"{col_elems[i]['bbox'][1]} < {col_elems[i - 1]['bbox'][1]}"
                )


def main():
    project_dir = "/home/user/reading_order"
    pdf_path = os.path.join(project_dir, "assets", "report.pdf")
    output_dir = os.path.join(project_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    pages_data, text_map, doc = process_document(pdf_path)

    # Validate outputs
    validate(pages_data, doc)

    # Write pages.json
    output_json = {"pages": pages_data}
    json_path = os.path.join(output_dir, "pages.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output_json, f, indent=2, ensure_ascii=False)
    print(f"Wrote {json_path}")

    # Write reading_order.txt
    all_texts = []
    for page in pages_data:
        for elem in page["elements"]:
            all_texts.append(text_map[elem["id"]])

    txt_path = os.path.join(output_dir, "reading_order.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(all_texts))
    print(f"Wrote {txt_path}")

    # Print summary
    print()
    for page in pages_data:
        print(
            f"Page {page['page_no']}: {page['column_count']} column(s), "
            f"{len(page['elements'])} elements"
        )


if __name__ == "__main__":
    main()
