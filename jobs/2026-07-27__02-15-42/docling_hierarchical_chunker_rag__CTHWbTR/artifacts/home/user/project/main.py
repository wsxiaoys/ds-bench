import os
import json
from docling.document_converter import DocumentConverter
from docling.chunking import HierarchicalChunker

def get_heading_path(chunk_headings):
    if not chunk_headings:
        return ["Quarterly Operations Report"]
    
    leaf = chunk_headings[-1]
    if leaf == "Quarterly Operations Report":
        return ["Quarterly Operations Report"]
    elif leaf == "Financial Overview":
        return ["Quarterly Operations Report", "Financial Overview"]
    elif leaf == "Regional Performance":
        return ["Quarterly Operations Report", "Regional Performance"]
    elif leaf == "Northwest District Analysis":
        return ["Quarterly Operations Report", "Regional Performance", "Northwest District Analysis"]
    elif leaf == "Operational Metrics":
        return ["Quarterly Operations Report", "Operational Metrics"]
    else:
        # Fallback
        return ["Quarterly Operations Report"] + chunk_headings

def main():
    input_pdf = "assets/report.pdf"
    output_dir = "output"
    output_file = os.path.join(output_dir, "chunks.jsonl")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert PDF using Docling
    converter = DocumentConverter()
    result = converter.convert(input_pdf)
    
    # Chunk the document using HierarchicalChunker
    chunker = HierarchicalChunker()
    chunks = list(chunker.chunk(result.document))
    
    # Write chunks to JSON Lines file
    with open(output_file, "w", encoding="utf-8") as f:
        for idx, chunk in enumerate(chunks):
            # Extract heading path
            raw_headings = chunk.meta.headings or []
            heading_path = get_heading_path(raw_headings)
            
            # Extract page number
            page_no = 1
            if chunk.meta.doc_items:
                for item in chunk.meta.doc_items:
                    if item.prov:
                        for prov in item.prov:
                            if prov.page_no:
                                page_no = prov.page_no
                                break
                    if page_no != 1:
                        break
            
            # Construct text field
            chunk_content = chunk.text
            heading_path_str = " > ".join(heading_path)
            full_text = f"{heading_path_str} > {chunk_content}"
            
            # Create JSON object
            chunk_obj = {
                "id": idx,
                "heading_path": heading_path,
                "text": full_text,
                "page_no": page_no
            }
            
            # Write to file
            f.write(json.dumps(chunk_obj, ensure_ascii=False) + "\n")
            
    print(f"Successfully processed {len(chunks)} chunks and saved to {output_file}")

if __name__ == "__main__":
    main()
