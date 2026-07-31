#!/usr/bin/env python3
"""Offline table-structure quality benchmark harness."""

import argparse
import json
import os
import re
import sys
import time
import unicodedata

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
from docling.document_converter import DocumentConverter, PdfFormatOption


def normalize_text(text: str) -> str:
    """Apply text normalization: NFKC, whitespace collapse, casefold, strip, filter."""
    if text is None:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    text = text.casefold()
    # Keep: Unicode letters, digits, spaces, '.', '-'
    text = "".join(ch for ch in text if ch.isalpha() or ch.isdigit() or ch in (" ", ".", "-"))
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    return text


def convert_bbox_bl_to_tl(bbox, page_height):
    """Convert a BOTTOMLEFT bbox to TOPLEFT coordinates [left, top, right, bottom]."""
    return [
        round(bbox.l, 2),
        round(page_height - bbox.t, 2),
        round(bbox.r, 2),
        round(page_height - bbox.b, 2),
    ]


def find_pred_cell(table_cells, row, col):
    """Find the recognized cell covering grid position (row, col).
    
    Returns the cell object or None. If multiple cells cover the position,
    the first one in table_cells order wins.
    """
    for cell in table_cells:
        if (cell.start_row_offset_idx <= row < cell.end_row_offset_idx and
                cell.start_col_offset_idx <= col < cell.end_col_offset_idx):
            return cell
    return None


def score_tables(gt_tables, pred_tables, page_heights):
    """Score predicted tables against ground truth tables."""
    results = []
    
    for gt_idx, gt_table in enumerate(gt_tables):
        gt_num_rows = gt_table["num_rows"]
        gt_num_cols = gt_table["num_cols"]
        gt_cells = gt_table["cells"]
        gt_cell_count = len(gt_cells)
        
        entry = {
            "table_index": gt_table["table_index"],
            "page_no": gt_table["page_no"],
            "gt_shape": [gt_num_rows, gt_num_cols],
            "pred_shape": None,
            "shape_match": False,
            "pred_page_no": None,
            "pred_bbox": None,
            "gt_cell_count": gt_cell_count,
            "matched_cells": 0,
            "cell_match_rate": 0.0,
            "span_agreements": 0,
            "span_match_rate": 0.0,
            "header_agreements": 0,
            "header_match_rate": 0.0,
            "cells": [],
        }
        
        if gt_idx < len(pred_tables):
            pred_table = pred_tables[gt_idx]
            pred_data = pred_table.data
            pred_num_rows = pred_data.num_rows
            pred_num_cols = pred_data.num_cols
            pred_cells = pred_data.table_cells
            
            if pred_table.prov:
                prov = pred_table.prov[0]
                pred_page_no = prov.page_no
                page_height = page_heights.get(pred_page_no, 792.0)
                pred_bbox = convert_bbox_bl_to_tl(prov.bbox, page_height)
            else:
                pred_page_no = None
                pred_bbox = None
            
            entry["pred_shape"] = [pred_num_rows, pred_num_cols]
            entry["shape_match"] = (pred_num_rows == gt_num_rows and pred_num_cols == gt_num_cols)
            entry["pred_page_no"] = pred_page_no
            entry["pred_bbox"] = pred_bbox
            
            matched_cells = 0
            span_agreements = 0
            header_agreements = 0
            
            for gt_cell in sorted(gt_cells, key=lambda c: (c["row"], c["col"])):
                row = gt_cell["row"]
                col = gt_cell["col"]
                gt_text_norm = normalize_text(gt_cell["text"])
                gt_span = [gt_cell["row_span"], gt_cell["col_span"]]
                gt_header = gt_cell["is_header"]
                
                pred_cell = find_pred_cell(pred_cells, row, col)
                
                if pred_cell is not None:
                    pred_text_norm = normalize_text(pred_cell.text)
                    pred_span = [pred_cell.row_span, pred_cell.col_span]
                    pred_header = pred_cell.column_header
                    
                    text_match = (gt_text_norm == pred_text_norm)
                    span_match = (gt_span == pred_span)
                    header_match = (gt_header == pred_header)
                    
                    if text_match:
                        matched_cells += 1
                    if span_match:
                        span_agreements += 1
                    if header_match:
                        header_agreements += 1
                else:
                    pred_text_norm = None
                    pred_span = None
                    pred_header = None
                    text_match = False
                    span_match = False
                    header_match = False
                
                cell_entry = {
                    "row": row,
                    "col": col,
                    "gt_text_normalized": gt_text_norm,
                    "pred_text_normalized": pred_text_norm,
                    "matched": text_match,
                    "gt_span": gt_span,
                    "pred_span": pred_span,
                    "span_match": span_match,
                    "gt_header": gt_header,
                    "pred_header": pred_header,
                    "header_match": header_match,
                }
                entry["cells"].append(cell_entry)
            
            entry["matched_cells"] = matched_cells
            entry["cell_match_rate"] = round(matched_cells / gt_cell_count, 4) if gt_cell_count > 0 else 0.0
            entry["span_agreements"] = span_agreements
            entry["span_match_rate"] = round(span_agreements / gt_cell_count, 4) if gt_cell_count > 0 else 0.0
            entry["header_agreements"] = header_agreements
            entry["header_match_rate"] = round(header_agreements / gt_cell_count, 4) if gt_cell_count > 0 else 0.0
        else:
            # Total miss
            for gt_cell in sorted(gt_cells, key=lambda c: (c["row"], c["col"])):
                row = gt_cell["row"]
                col = gt_cell["col"]
                gt_text_norm = normalize_text(gt_cell["text"])
                gt_span = [gt_cell["row_span"], gt_cell["col_span"]]
                gt_header = gt_cell["is_header"]
                
                cell_entry = {
                    "row": row,
                    "col": col,
                    "gt_text_normalized": gt_text_norm,
                    "pred_text_normalized": None,
                    "matched": False,
                    "gt_span": gt_span,
                    "pred_span": None,
                    "span_match": False,
                    "gt_header": gt_header,
                    "pred_header": None,
                    "header_match": False,
                }
                entry["cells"].append(cell_entry)
        
        results.append(entry)
    
    return results


def build_error_tables(gt_tables):
    """Build table entries for a failed conversion (all total misses)."""
    tables = []
    for gt_table in gt_tables:
        gt_num_rows = gt_table["num_rows"]
        gt_num_cols = gt_table["num_cols"]
        gt_cells = gt_table["cells"]
        gt_cell_count = len(gt_cells)
        
        entry = {
            "table_index": gt_table["table_index"],
            "page_no": gt_table["page_no"],
            "gt_shape": [gt_num_rows, gt_num_cols],
            "pred_shape": None,
            "shape_match": False,
            "pred_page_no": None,
            "pred_bbox": None,
            "gt_cell_count": gt_cell_count,
            "matched_cells": 0,
            "cell_match_rate": 0.0,
            "span_agreements": 0,
            "span_match_rate": 0.0,
            "header_agreements": 0,
            "header_match_rate": 0.0,
            "cells": [],
        }
        
        for gt_cell in sorted(gt_cells, key=lambda c: (c["row"], c["col"])):
            row = gt_cell["row"]
            col = gt_cell["col"]
            gt_text_norm = normalize_text(gt_cell["text"])
            gt_span = [gt_cell["row_span"], gt_cell["col_span"]]
            gt_header = gt_cell["is_header"]
            
            cell_entry = {
                "row": row,
                "col": col,
                "gt_text_normalized": gt_text_norm,
                "pred_text_normalized": None,
                "matched": False,
                "gt_span": gt_span,
                "pred_span": None,
                "span_match": False,
                "gt_header": gt_header,
                "pred_header": None,
                "header_match": False,
            }
            entry["cells"].append(cell_entry)
        
        tables.append(entry)
    return tables


def process_document(converter, pdf_path, gt_data, mode_name):
    """Process a single document with a given mode.
    
    Returns (mode_result, duration_seconds, error_message_or_None).
    """
    start = time.perf_counter()
    
    try:
        result = converter.convert(pdf_path)
        doc = result.document
        
        page_heights = {}
        for page_no, page in doc.pages.items():
            page_heights[page_no] = page.size.height
        
        pred_tables = list(doc.tables)
        pred_table_count = len(pred_tables)
        gt_table_count = len(gt_data["tables"])
        unmatched_predicted = max(0, pred_table_count - gt_table_count)
        
        tables = score_tables(gt_data["tables"], pred_tables, page_heights)
        
        duration = round(time.perf_counter() - start, 3)
        
        mode_result = {
            "mode": mode_name,
            "cell_matching": True,
            "converted": True,
            "error": None,
            "predicted_table_count": pred_table_count,
            "unmatched_predicted_tables": unmatched_predicted,
            "tables": tables,
        }
        
        return mode_result, duration, None
        
    except Exception as e:
        duration = round(time.perf_counter() - start, 3)
        
        tables = build_error_tables(gt_data["tables"])
        
        mode_result = {
            "mode": mode_name,
            "cell_matching": True,
            "converted": False,
            "error": str(e),
            "predicted_table_count": 0,
            "unmatched_predicted_tables": 0,
            "tables": tables,
        }
        
        return mode_result, duration, str(e)


def build_aggregate(doc_ids, doc_results, corpus_dir):
    """Build aggregate.json from per-document results."""
    modes_agg = {}
    
    for mode_name in ["fast", "accurate"]:
        first_doc = doc_ids[0] if doc_ids else None
        if first_doc is None or mode_name not in doc_results[first_doc]["modes"]:
            continue
        
        documents_run = 0
        documents_converted = 0
        documents_failed = 0
        predicted_table_count = 0
        shape_match_count = 0
        matched_cells = 0
        span_agreements = 0
        header_agreements = 0
        
        for doc_id in doc_ids:
            dr = doc_results[doc_id]
            mr = dr["modes"][mode_name]
            documents_run += 1
            if mr["converted"]:
                documents_converted += 1
            else:
                documents_failed += 1
            
            predicted_table_count += mr["predicted_table_count"]
            
            for table in mr["tables"]:
                if table["shape_match"]:
                    shape_match_count += 1
                matched_cells += table["matched_cells"]
                span_agreements += table["span_agreements"]
                header_agreements += table["header_agreements"]
        
        total_gt_tables = sum(dr["gt_table_count"] for dr in doc_results.values())
        total_gt_cells = sum(dr["gt_cell_count"] for dr in doc_results.values())
        
        shape_match_rate = round(shape_match_count / total_gt_tables, 4) if total_gt_tables > 0 else 0.0
        cell_match_rate = round(matched_cells / total_gt_cells, 4) if total_gt_cells > 0 else 0.0
        span_match_rate = round(span_agreements / total_gt_cells, 4) if total_gt_cells > 0 else 0.0
        header_match_rate = round(header_agreements / total_gt_cells, 4) if total_gt_cells > 0 else 0.0
        
        modes_agg[mode_name] = {
            "mode": mode_name,
            "cell_matching": True,
            "documents_run": documents_run,
            "documents_converted": documents_converted,
            "documents_failed": documents_failed,
            "predicted_table_count": predicted_table_count,
            "shape_match_count": shape_match_count,
            "shape_match_rate": shape_match_rate,
            "matched_cells": matched_cells,
            "cell_match_rate": cell_match_rate,
            "span_agreements": span_agreements,
            "span_match_rate": span_match_rate,
            "header_agreements": header_agreements,
            "header_match_rate": header_match_rate,
        }
    
    # Determine best mode
    if "fast" in modes_agg and "accurate" in modes_agg:
        fast_rate = modes_agg["fast"]["cell_match_rate"]
        accurate_rate = modes_agg["accurate"]["cell_match_rate"]
        if fast_rate >= accurate_rate:
            best_mode = "fast"
            best_cell_match_rate = fast_rate
        else:
            best_mode = "accurate"
            best_cell_match_rate = accurate_rate
    elif "fast" in modes_agg:
        best_mode = "fast"
        best_cell_match_rate = modes_agg["fast"]["cell_match_rate"]
    elif "accurate" in modes_agg:
        best_mode = "accurate"
        best_cell_match_rate = modes_agg["accurate"]["cell_match_rate"]
    else:
        best_mode = "fast"
        best_cell_match_rate = 0.0
    
    passed = best_cell_match_rate >= 0.5
    
    # Compute overall counts
    gt_table_count = sum(dr["gt_table_count"] for dr in doc_results.values())
    gt_cell_count = sum(dr["gt_cell_count"] for dr in doc_results.values())
    
    return {
        "corpus_dir": corpus_dir,
        "doc_ids": sorted(doc_ids),
        "doc_count": len(doc_ids),
        "gt_table_count": gt_table_count,
        "gt_cell_count": gt_cell_count,
        "modes": modes_agg,
        "best_mode": best_mode,
        "best_cell_match_rate": best_cell_match_rate,
        "quality_gate": {
            "min_cell_match_rate": 0.5,
            "passed": passed,
        },
    }


def build_comparison(doc_ids, doc_results):
    """Build comparison.json (only when both modes ran)."""
    tables = []
    
    for doc_id in sorted(doc_ids):
        dr = doc_results[doc_id]
        if "fast" not in dr["modes"] or "accurate" not in dr["modes"]:
            continue
        
        fast_tables = dr["modes"]["fast"]["tables"]
        accurate_tables = dr["modes"]["accurate"]["tables"]
        
        for gt_idx in range(len(fast_tables)):
            ft = fast_tables[gt_idx]
            at = accurate_tables[gt_idx]
            
            fast_shape = ft["pred_shape"]
            accurate_shape = at["pred_shape"]
            shape_differs = (fast_shape != accurate_shape)
            
            fast_cmr = ft["cell_match_rate"]
            accurate_cmr = at["cell_match_rate"]
            delta = round(accurate_cmr - fast_cmr, 4)
            
            if delta > 0:
                verdict = "accurate_better"
            elif delta < 0:
                verdict = "fast_better"
            else:
                verdict = "tie"
            
            # Find differing cells
            differing_cells = []
            fast_cells = ft["cells"]
            accurate_cells = at["cells"]
            
            for fc, ac in zip(fast_cells, accurate_cells):
                row = fc["row"]
                col = fc["col"]
                f_text = fc["pred_text_normalized"]
                a_text = ac["pred_text_normalized"]
                
                # null differs from any string; two nulls do not differ
                if f_text != a_text:
                    differing_cells.append([row, col])
            
            differing_cells.sort(key=lambda x: (x[0], x[1]))
            
            tables.append({
                "doc_id": doc_id,
                "table_index": gt_idx,
                "fast_shape": fast_shape,
                "accurate_shape": accurate_shape,
                "shape_differs": shape_differs,
                "fast_cell_match_rate": fast_cmr,
                "accurate_cell_match_rate": accurate_cmr,
                "cell_match_rate_delta": delta,
                "differing_cells": differing_cells,
                "differing_cell_count": len(differing_cells),
                "verdict": verdict,
            })
    
    # Summary
    tables_compared = len(tables)
    accurate_better = sum(1 for t in tables if t["verdict"] == "accurate_better")
    fast_better = sum(1 for t in tables if t["verdict"] == "fast_better")
    tie = sum(1 for t in tables if t["verdict"] == "tie")
    shape_differs_count = sum(1 for t in tables if t["shape_differs"])
    
    return {
        "modes": ["fast", "accurate"],
        "tables": tables,
        "summary": {
            "tables_compared": tables_compared,
            "accurate_better": accurate_better,
            "fast_better": fast_better,
            "tie": tie,
            "shape_differs_count": shape_differs_count,
        },
    }


def build_timing(timing_data):
    """Build timing.json."""
    modes_timing = {}
    total_seconds = timing_data["total_seconds"]
    
    for mode_name in ["fast", "accurate"]:
        if mode_name not in timing_data["modes"]:
            continue
        
        td = timing_data["modes"][mode_name]
        documents = td["documents"]
        durations = td["durations"]
        
        if durations:
            total = round(sum(durations), 3)
            mean = round(total / documents, 3) if documents > 0 else 0.0
            min_val = round(min(durations), 3)
            max_val = round(max(durations), 3)
        else:
            total = 0.0
            mean = 0.0
            min_val = 0.0
            max_val = 0.0
        
        modes_timing[mode_name] = {
            "documents": documents,
            "total_seconds": total,
            "mean_seconds_per_document": mean,
            "min_seconds": min_val,
            "max_seconds": max_val,
        }
    
    return {
        "modes": modes_timing,
        "total_seconds": round(total_seconds, 3),
    }


def write_json(path, data):
    """Write JSON to a file deterministically (sorted keys, no trailing whitespace, newline at end)."""
    json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    with open(path, "w", encoding="utf-8") as f:
        f.write(json_str)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser(description="Table structure quality benchmark")
    parser.add_argument("--corpus", default="corpus", help="Corpus directory (default: corpus)")
    parser.add_argument("--out", default="reports", help="Output directory (default: reports)")
    parser.add_argument("--doc", default=None, help="Single doc_id to process")
    parser.add_argument("--mode", default="both", choices=["fast", "accurate", "both"],
                        help="Table structure mode (default: both)")
    args = parser.parse_args()
    
    # Resolve paths
    corpus_dir = os.path.abspath(args.corpus)
    out_dir = os.path.abspath(args.out)
    docs_out_dir = os.path.join(out_dir, "docs")
    
    # Validate corpus directory
    if not os.path.isdir(corpus_dir):
        print(f"ERROR: corpus directory not found: {corpus_dir}", file=sys.stderr)
        sys.exit(4)
    
    gt_dir = os.path.join(corpus_dir, "ground_truth")
    
    # Discover PDFs
    pdf_files = sorted([f for f in os.listdir(corpus_dir) if f.endswith(".pdf")])
    if not pdf_files:
        print("ERROR: no PDF files found in corpus directory", file=sys.stderr)
        sys.exit(4)
    
    # Build doc_id -> (pdf_path, gt_path) mapping
    docs_map = {}
    for pdf_file in pdf_files:
        doc_id = pdf_file[:-4]  # strip .pdf
        pdf_path = os.path.join(corpus_dir, pdf_file)
        gt_path = os.path.join(gt_dir, f"{doc_id}.json")
        if not os.path.isfile(gt_path):
            print(f"ERROR: no ground truth file for {pdf_file} at {gt_path}", file=sys.stderr)
            sys.exit(4)
        docs_map[doc_id] = (pdf_path, gt_path)
    
    # Filter by --doc if specified
    if args.doc:
        if args.doc not in docs_map:
            print(f"ERROR: unknown document: {args.doc}", file=sys.stderr)
            sys.exit(4)
        selected_ids = [args.doc]
    else:
        selected_ids = sorted(docs_map.keys())
    
    if not selected_ids:
        print("ERROR: nothing to run", file=sys.stderr)
        sys.exit(4)
    
    # Determine modes to run
    modes_to_run = []
    if args.mode == "both":
        modes_to_run = ["fast", "accurate"]
    else:
        modes_to_run = [args.mode]
    
    # Validate: if nothing to run (shouldn't happen but be safe)
    if not modes_to_run:
        print("ERROR: nothing to run", file=sys.stderr)
        sys.exit(4)
    
    # Load ground truth data
    gt_data_map = {}
    for doc_id in selected_ids:
        pdf_path, gt_path = docs_map[doc_id]
        with open(gt_path, "r", encoding="utf-8") as f:
            gt_data_map[doc_id] = json.load(f)
    
    # Create output directories
    os.makedirs(docs_out_dir, exist_ok=True)
    
    # Create converters for each mode
    converters = {}
    for mode_name in modes_to_run:
        opts = PdfPipelineOptions()
        if mode_name == "fast":
            opts.table_structure_options.mode = TableFormerMode.FAST
        else:
            opts.table_structure_options.mode = TableFormerMode.ACCURATE
        opts.table_structure_options.do_cell_matching = True
        opts.generate_page_images = False
        opts.generate_picture_images = False
        opts.generate_table_images = False
        
        converters[mode_name] = DocumentConverter(format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=opts)
        })
    
    # Timing data
    overall_start = time.perf_counter()
    timing_data = {
        "modes": {},
        "total_seconds": 0.0,
    }
    for mode_name in modes_to_run:
        timing_data["modes"][mode_name] = {
            "documents": 0,
            "durations": [],
        }
    
    # Process documents
    doc_results = {}
    any_failure = False
    
    for doc_id in selected_ids:
        pdf_path, gt_path = docs_map[doc_id]
        gt_data = gt_data_map[doc_id]
        
        gt_table_count = len(gt_data["tables"])
        gt_cell_count = sum(len(t["cells"]) for t in gt_data["tables"])
        
        doc_result = {
            "doc_id": doc_id,
            "pdf": os.path.basename(pdf_path),
            "gt_table_count": gt_table_count,
            "gt_cell_count": gt_cell_count,
            "modes": {},
        }
        
        for mode_name in modes_to_run:
            converter = converters[mode_name]
            mode_result, duration, error = process_document(
                converter, pdf_path, gt_data, mode_name
            )
            
            doc_result["modes"][mode_name] = mode_result
            timing_data["modes"][mode_name]["documents"] += 1
            timing_data["modes"][mode_name]["durations"].append(duration)
            
            if error:
                any_failure = True
        
        doc_results[doc_id] = doc_result
        
        # Write per-document JSON
        write_json(os.path.join(docs_out_dir, f"{doc_id}.json"), doc_result)
    
    overall_end = time.perf_counter()
    timing_data["total_seconds"] = overall_end - overall_start
    
    # Write timing.json
    timing = build_timing(timing_data)
    write_json(os.path.join(out_dir, "timing.json"), timing)
    
    # Write aggregate.json
    aggregate = build_aggregate(selected_ids, doc_results, args.corpus)
    write_json(os.path.join(out_dir, "aggregate.json"), aggregate)
    
    # Write comparison.json if both modes ran
    if "fast" in modes_to_run and "accurate" in modes_to_run:
        comparison = build_comparison(selected_ids, doc_results)
        write_json(os.path.join(out_dir, "comparison.json"), comparison)
    
    # Determine exit code
    best_mode = aggregate["best_mode"]
    best_cell_match_rate = aggregate["best_cell_match_rate"]
    passed = aggregate["quality_gate"]["passed"]
    
    # Print GATE line
    gate_status = "PASS" if passed else "FAIL"
    print(f"GATE {gate_status} best_mode={best_mode} cell_match_rate={best_cell_match_rate:.4f}")
    
    # Exit code priority: 4 > 5 > 3 > 0
    if any_failure:
        sys.exit(5)
    elif not passed:
        sys.exit(3)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
