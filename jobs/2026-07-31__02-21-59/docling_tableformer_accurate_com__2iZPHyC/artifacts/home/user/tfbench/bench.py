#!/usr/bin/env python3
import os
import sys
import glob
import json
import time
import argparse
import unicodedata
import re
import gc

# Configure standard logging to go to stderr and be quiet
import logging
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)

class CustomArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        sys.stderr.write(f"error: {message}\n")
        sys.exit(2)

def normalize_text(text: str) -> str:
    if text is None:
        return ""
    # 1. Unicode NFKC normalization
    text = unicodedata.normalize('NFKC', text)
    # 2. Replace every run of whitespace characters with a single ASCII space
    text = re.sub(r'\s+', ' ', text)
    # 3. Strip leading/trailing spaces
    text = text.strip()
    # 4. Casefold
    text = text.casefold()
    # 5. Delete every character that is not a Unicode letter, a Unicode digit, a space, . or -
    text = "".join(c for c in text if c.isalnum() or c in (' ', '.', '-'))
    # 6. Replace runs of spaces with a single space again
    text = re.sub(r' +', ' ', text)
    # 7. Strip again
    text = text.strip()
    return text

def score_table(gt_table, pred_table, res=None):
    gt_num_rows = gt_table["num_rows"]
    gt_num_cols = gt_table["num_cols"]
    gt_shape = [gt_num_rows, gt_num_cols]
    
    if pred_table is not None:
        pred_num_rows = pred_table.data.num_rows
        pred_num_cols = pred_table.data.num_cols
        pred_shape = [pred_num_rows, pred_num_cols]
        shape_match = (gt_num_rows == pred_num_rows and gt_num_cols == pred_num_cols)
        
        if pred_table.prov:
            pred_page_no = pred_table.prov[0].page_no
            bbox = pred_table.prov[0].bbox
            if bbox is not None:
                # Get page height to convert to top-left origin if possible
                page_height = None
                if res is not None and res.pages and 1 <= pred_page_no <= len(res.pages):
                    page_height = res.pages[pred_page_no - 1].size.height
                
                if page_height is not None:
                    try:
                        bbox = bbox.to_top_left_origin(page_height)
                    except Exception:
                        pass
                pred_bbox = [round(bbox.l, 2), round(bbox.t, 2), round(bbox.r, 2), round(bbox.b, 2)]
            else:
                pred_bbox = None
        else:
            pred_page_no = None
            pred_bbox = None
    else:
        pred_shape = None
        shape_match = False
        pred_page_no = None
        pred_bbox = None
        
    cells_report = []
    matched_cells = 0
    span_agreements = 0
    header_agreements = 0
    
    sorted_gt_cells = sorted(gt_table["cells"], key=lambda c: (c["row"], c["col"]))
    
    for gt_cell in sorted_gt_cells:
        gt_row = gt_cell["row"]
        gt_col = gt_cell["col"]
        gt_text = gt_cell["text"]
        gt_text_norm = normalize_text(gt_text)
        gt_row_span = gt_cell["row_span"]
        gt_col_span = gt_cell["col_span"]
        gt_span = [gt_row_span, gt_col_span]
        gt_header = gt_cell["is_header"]
        
        pred_cell = None
        if pred_table is not None:
            for cell in pred_table.data.table_cells:
                r_start = cell.start_row_offset_idx
                r_end = cell.start_row_offset_idx + cell.row_span
                c_start = cell.start_col_offset_idx
                c_end = cell.start_col_offset_idx + cell.col_span
                if (r_start <= gt_row < r_end) and (c_start <= gt_col < c_end):
                    pred_cell = cell
                    break
                    
        if pred_cell is not None:
            pred_text_norm = normalize_text(pred_cell.text)
            matched = (gt_text_norm == pred_text_norm)
            
            pred_span = [pred_cell.row_span, pred_cell.col_span]
            span_match = (gt_row_span == pred_cell.row_span and gt_col_span == pred_cell.col_span)
            
            pred_header = bool(pred_cell.column_header)
            header_match = (gt_header == pred_header)
        else:
            pred_text_norm = None
            matched = False
            pred_span = None
            span_match = False
            pred_header = None
            header_match = False
            
        if matched:
            matched_cells += 1
        if span_match:
            span_agreements += 1
        if header_match:
            header_agreements += 1
            
        cells_report.append({
            "row": gt_row,
            "col": gt_col,
            "gt_text_normalized": gt_text_norm,
            "pred_text_normalized": pred_text_norm,
            "matched": matched,
            "gt_span": gt_span,
            "pred_span": pred_span,
            "span_match": span_match,
            "gt_header": gt_header,
            "pred_header": pred_header,
            "header_match": header_match
        })
        
    gt_cell_count = len(sorted_gt_cells)
    cell_match_rate = round(matched_cells / gt_cell_count, 4) if gt_cell_count > 0 else 0.0
    span_match_rate = round(span_agreements / gt_cell_count, 4) if gt_cell_count > 0 else 0.0
    header_match_rate = round(header_agreements / gt_cell_count, 4) if gt_cell_count > 0 else 0.0
    
    return {
        "table_index": gt_table["table_index"],
        "page_no": gt_table["page_no"],
        "gt_shape": gt_shape,
        "pred_shape": pred_shape,
        "shape_match": shape_match,
        "pred_page_no": pred_page_no,
        "pred_bbox": pred_bbox,
        "gt_cell_count": gt_cell_count,
        "matched_cells": matched_cells,
        "cell_match_rate": cell_match_rate,
        "span_agreements": span_agreements,
        "span_match_rate": span_match_rate,
        "header_agreements": header_agreements,
        "header_match_rate": header_match_rate,
        "cells": cells_report
    }

def get_converter(mode_str: str):
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling.datamodel.base_models import InputFormat

    pipeline_options = PdfPipelineOptions()
    if mode_str == "fast":
        pipeline_options.table_structure_options.mode = TableFormerMode.FAST
    else:
        pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE
    pipeline_options.table_structure_options.do_cell_matching = True

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

def main():
    start_time_all = time.time()
    
    parser = CustomArgumentParser(description="Offline Table-Structure Quality Benchmark Harness", add_help=False)
    parser.add_argument("--corpus", default="corpus", type=str)
    parser.add_argument("--out", default="reports", type=str)
    parser.add_argument("--doc", default=None, type=str)
    parser.add_argument("--mode", default="both", choices=["fast", "accurate", "both"], type=str)
    
    args = parser.parse_args()
    
    # 1. Validate corpus directory
    corpus_dir = args.corpus
    if not os.path.isdir(corpus_dir):
        sys.stderr.write(f"Corpus directory not found: {corpus_dir}\n")
        sys.exit(4)
        
    # 2. Discover PDFs
    pdf_pattern = os.path.join(corpus_dir, "*.pdf")
    pdf_files = glob.glob(pdf_pattern)
    if not pdf_files:
        sys.stderr.write(f"No PDFs found in corpus directory: {corpus_dir}\n")
        sys.exit(4)
        
    # Build dictionary of discovered documents
    discovered_docs = {}
    for pdf_path in pdf_files:
        doc_id = os.path.splitext(os.path.basename(pdf_path))[0]
        discovered_docs[doc_id] = pdf_path
        
    # 3. Validate ground truth files for all discovered PDFs
    gt_dir = os.path.join(corpus_dir, "ground_truth")
    for doc_id, pdf_path in discovered_docs.items():
        gt_path = os.path.join(gt_dir, f"{doc_id}.json")
        if not os.path.isfile(gt_path):
            sys.stderr.write(f"Ground truth file not found for discovered PDF '{doc_id}': {gt_path}\n")
            sys.exit(4)
            
    # 4. If --doc is specified, check if it exists in discovered documents
    if args.doc is not None:
        if args.doc not in discovered_docs:
            sys.stderr.write(f"Unknown document specified: {args.doc}\n")
            sys.exit(4)
        selected_doc_ids = [args.doc]
    else:
        selected_doc_ids = sorted(discovered_docs.keys())
        
    if not selected_doc_ids:
        sys.stderr.write("No documents selected to run\n")
        sys.exit(4)
        
    # 5. Setup output directories AFTER validation succeeds
    out_dir = args.out
    docs_dir = os.path.join(out_dir, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    
    # Determine modes to run
    if args.mode == "both":
        modes_to_run = ["fast", "accurate"]
    else:
        modes_to_run = [args.mode]
        
    # We will store results in a structured format:
    # doc_results[doc_id] = { "doc_id": ..., "pdf": ..., "gt_table_count": ..., "gt_cell_count": ..., "modes": { "fast": ..., "accurate": ... } }
    doc_results = {}
    for doc_id in selected_doc_ids:
        # Load ground truth to get top-level counts
        gt_path = os.path.join(gt_dir, f"{doc_id}.json")
        with open(gt_path, "r", encoding="utf-8") as f:
            gt_data = json.load(f)
        
        gt_table_count = len(gt_data["tables"])
        gt_cell_count = sum(len(t["cells"]) for t in gt_data["tables"])
        
        doc_results[doc_id] = {
            "doc_id": doc_id,
            "pdf": gt_data["pdf"],
            "gt_table_count": gt_table_count,
            "gt_cell_count": gt_cell_count,
            "modes": {}
        }
        
    any_conversion_failed = False
    timing_report = {
        "modes": {},
        "total_seconds": 0.0
    }
    
    from docling.datamodel.base_models import ConversionStatus
    
    # 6. Run modes sequentially
    for mode in modes_to_run:
        sys.stderr.write(f"Initializing converter for mode: {mode}\n")
        converter = get_converter(mode)
        
        mode_durations = []
        
        for doc_id in selected_doc_ids:
            sys.stderr.write(f"Processing {doc_id} with mode {mode}...\n")
            pdf_path = discovered_docs[doc_id]
            
            # Load ground truth for scoring
            gt_path = os.path.join(gt_dir, f"{doc_id}.json")
            with open(gt_path, "r", encoding="utf-8") as f:
                gt_data = json.load(f)
                
            doc_start = time.time()
            
            converted = False
            error_msg = None
            res = None
            
            try:
                res = converter.convert(pdf_path)
                if res.status == ConversionStatus.SUCCESS:
                    converted = True
                else:
                    converted = False
                    error_msg = "; ".join(str(err) for err in res.errors) if res.errors else "Conversion failed without specific error"
            except Exception as e:
                converted = False
                error_msg = str(e)
                
            doc_duration = time.time() - doc_start
            mode_durations.append(doc_duration)
            
            if not converted:
                any_conversion_failed = True
                sys.stderr.write(f"Failed to convert {doc_id} in {mode} mode: {error_msg}\n")
                
            # Extract recognized tables
            pred_tables = []
            if converted and res is not None and res.document is not None:
                pred_tables = getattr(res.document, "tables", [])
                
            predicted_table_count = len(pred_tables)
            unmatched_predicted_tables = max(0, predicted_table_count - len(gt_data["tables"]))
            
            # Score each ground-truth table
            scored_tables = []
            for i, gt_table in enumerate(gt_data["tables"]):
                pred_table = pred_tables[i] if i < len(pred_tables) else None
                scored_tbl = score_table(gt_table, pred_table, res=res)
                scored_tables.append(scored_tbl)
                
            # Construct mode result dict
            mode_result = {
                "mode": mode,
                "cell_matching": True,
                "converted": converted,
                "error": error_msg,
                "predicted_table_count": predicted_table_count,
                "unmatched_predicted_tables": unmatched_predicted_tables,
                "tables": scored_tables
            }
            
            doc_results[doc_id]["modes"][mode] = mode_result
            
        # Record timing for this mode
        timing_report["modes"][mode] = {
            "documents": len(selected_doc_ids),
            "total_seconds": round(sum(mode_durations), 3),
            "mean_seconds_per_document": round(sum(mode_durations) / len(selected_doc_ids), 3) if selected_doc_ids else 0.0,
            "min_seconds": round(min(mode_durations), 3) if mode_durations else 0.0,
            "max_seconds": round(max(mode_durations), 3) if mode_durations else 0.0
        }
        
        # Cleanup converter to release memory
        converter = None
        gc.collect()
        
    # 7. Write docs/<doc_id>.json reports
    for doc_id, doc_res in doc_results.items():
        doc_report_path = os.path.join(docs_dir, f"{doc_id}.json")
        with open(doc_report_path, "w", encoding="utf-8") as f:
            json.dump(doc_res, f, indent=2, ensure_ascii=False)
            f.write("\n")
            
    # 8. Calculate Aggregates
    total_gt_table_count = sum(doc["gt_table_count"] for doc in doc_results.values())
    total_gt_cell_count = sum(doc["gt_cell_count"] for doc in doc_results.values())
    
    mode_aggregates = {}
    for mode in modes_to_run:
        documents_run = len(selected_doc_ids)
        documents_converted = sum(1 for doc_id in selected_doc_ids if doc_results[doc_id]["modes"][mode]["converted"])
        documents_failed = documents_run - documents_converted
        
        predicted_table_count = sum(doc_results[doc_id]["modes"][mode]["predicted_table_count"] for doc_id in selected_doc_ids)
        
        shape_match_count = 0
        matched_cells = 0
        span_agreements = 0
        header_agreements = 0
        
        for doc_id in selected_doc_ids:
            mode_res = doc_results[doc_id]["modes"][mode]
            for tbl in mode_res["tables"]:
                if tbl["shape_match"]:
                    shape_match_count += 1
                matched_cells += tbl["matched_cells"]
                span_agreements += tbl["span_agreements"]
                header_agreements += tbl["header_agreements"]
                
        shape_match_rate = round(shape_match_count / total_gt_table_count, 4) if total_gt_table_count > 0 else 0.0
        cell_match_rate = round(matched_cells / total_gt_cell_count, 4) if total_gt_cell_count > 0 else 0.0
        span_match_rate = round(span_agreements / total_gt_cell_count, 4) if total_gt_cell_count > 0 else 0.0
        header_match_rate = round(header_agreements / total_gt_cell_count, 4) if total_gt_cell_count > 0 else 0.0
        
        mode_aggregates[mode] = {
            "mode": mode,
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
            "header_match_rate": header_match_rate
        }
        
    # Quality Gate and Best Mode
    if "fast" in modes_to_run and "accurate" in modes_to_run:
        rate_fast = mode_aggregates["fast"]["cell_match_rate"]
        rate_acc = mode_aggregates["accurate"]["cell_match_rate"]
        if rate_acc > rate_fast:
            best_mode = "accurate"
            best_cell_match_rate = rate_acc
        else:
            best_mode = "fast"
            best_cell_match_rate = rate_fast
    elif "fast" in modes_to_run:
        best_mode = "fast"
        best_cell_match_rate = mode_aggregates["fast"]["cell_match_rate"]
    else:
        best_mode = "accurate"
        best_cell_match_rate = mode_aggregates["accurate"]["cell_match_rate"]
        
    gate_passed = (best_cell_match_rate >= 0.5)
    
    aggregate_report = {
        "corpus_dir": args.corpus,
        "doc_ids": selected_doc_ids,
        "doc_count": len(selected_doc_ids),
        "gt_table_count": total_gt_table_count,
        "gt_cell_count": total_gt_cell_count,
        "modes": mode_aggregates,
        "best_mode": best_mode,
        "best_cell_match_rate": best_cell_match_rate,
        "quality_gate": {
            "min_cell_match_rate": 0.5,
            "passed": gate_passed
        }
    }
    
    # Write aggregate.json
    aggregate_path = os.path.join(out_dir, "aggregate.json")
    with open(aggregate_path, "w", encoding="utf-8") as f:
        json.dump(aggregate_report, f, indent=2, ensure_ascii=False)
        f.write("\n")
        
    # 9. Write comparison.json only when both modes ran
    if "fast" in modes_to_run and "accurate" in modes_to_run:
        comparison_tables = []
        accurate_better = 0
        fast_better = 0
        tie = 0
        shape_differs_count = 0
        
        for doc_id in selected_doc_ids:
            gt_path = os.path.join(gt_dir, f"{doc_id}.json")
            with open(gt_path, "r", encoding="utf-8") as f:
                gt_data = json.load(f)
                
            fast_mode_res = doc_results[doc_id]["modes"]["fast"]
            acc_mode_res = doc_results[doc_id]["modes"]["accurate"]
            
            for i in range(len(gt_data["tables"])):
                fast_tbl = fast_mode_res["tables"][i]
                acc_tbl = acc_mode_res["tables"][i]
                
                fast_shape = fast_tbl["pred_shape"]
                acc_shape = acc_tbl["pred_shape"]
                shape_differs = (fast_shape != acc_shape)
                if shape_differs:
                    shape_differs_count += 1
                    
                fast_rate = fast_tbl["cell_match_rate"]
                acc_rate = acc_tbl["cell_match_rate"]
                
                delta = round(acc_rate - fast_rate, 4)
                if delta > 0:
                    verdict = "accurate_better"
                    accurate_better += 1
                elif delta < 0:
                    verdict = "fast_better"
                    fast_better += 1
                else:
                    verdict = "tie"
                    tie += 1
                    
                # Collect differing cell probes
                differing_cells = []
                # Ground truth cells are aligned in cells list in (row, col) order
                for cell_idx in range(len(fast_tbl["cells"])):
                    fast_cell = fast_tbl["cells"][cell_idx]
                    acc_cell = acc_tbl["cells"][cell_idx]
                    
                    if fast_cell["pred_text_normalized"] != acc_cell["pred_text_normalized"]:
                        differing_cells.append([fast_cell["row"], fast_cell["col"]])
                        
                comparison_tables.append({
                    "doc_id": doc_id,
                    "table_index": i,
                    "fast_shape": fast_shape,
                    "accurate_shape": acc_shape,
                    "shape_differs": shape_differs,
                    "fast_cell_match_rate": fast_rate,
                    "accurate_cell_match_rate": acc_rate,
                    "cell_match_rate_delta": delta,
                    "differing_cells": sorted(differing_cells),
                    "differing_cell_count": len(differing_cells),
                    "verdict": verdict
                })
                
        comparison_report = {
            "modes": ["fast", "accurate"],
            "tables": comparison_tables,
            "summary": {
                "tables_compared": len(comparison_tables),
                "accurate_better": accurate_better,
                "fast_better": fast_better,
                "tie": tie,
                "shape_differs_count": shape_differs_count
            }
        }
        
        comparison_path = os.path.join(out_dir, "comparison.json")
        with open(comparison_path, "w", encoding="utf-8") as f:
            json.dump(comparison_report, f, indent=2, ensure_ascii=False)
            f.write("\n")
            
    # 10. Write timing.json
    timing_report["total_seconds"] = round(time.time() - start_time_all, 3)
    timing_path = os.path.join(out_dir, "timing.json")
    with open(timing_path, "w", encoding="utf-8") as f:
        json.dump(timing_report, f, indent=2, ensure_ascii=False)
        f.write("\n")
        
    # Output the required last non-empty line of stdout
    gate_status = "PASS" if gate_passed else "FAIL"
    print(f"GATE {gate_status} best_mode={best_mode} cell_match_rate={best_cell_match_rate:.4f}")
    
    # Determine exit code
    if any_conversion_failed:
        sys.exit(5)
    elif not gate_passed:
        sys.exit(3)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
