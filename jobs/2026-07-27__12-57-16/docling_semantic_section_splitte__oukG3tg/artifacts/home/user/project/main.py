import os
import re
import json
from docling.document_converter import DocumentConverter

def slug(s):
    # lowercase s
    s_lower = s.lower()
    # replace every maximal run of characters outside [a-z0-9] with a single '-'
    replaced = re.sub(r'[^a-z0-9]+', '-', s_lower)
    # strip any leading and trailing '-'
    return replaced.strip('-')

def main():
    # Create output directories
    os.makedirs("output/sections", exist_ok=True)

    # Convert document
    converter = DocumentConverter()
    result = converter.convert("assets/report.pdf")
    doc = result.document

    # Heading regex pattern matching outline numbers like "1 ", "2.1 ", "3.2.1 "
    heading_regex = re.compile(r'^(\d+(?:\.\d+){0,2})\s')

    # Parse headings and identify the top title
    headings = []
    title_text = None

    for item, _ in doc.iterate_items():
        text = getattr(item, "text", "").strip()
        if not text:
            continue
        
        match = heading_regex.match(text)
        if match:
            outline_num = match.group(1)
            level = len(outline_num.split('.'))
            page_no = 1
            if getattr(item, "prov", None) and len(item.prov) > 0:
                page_no = item.prov[0].page_no
                
            headings.append({
                "title": text,
                "level": level,
                "anchor": slug(text),
                "page_no": page_no,
                "children": []
            })
        else:
            if title_text is None:
                title_text = text

    # If no title was found, fallback to doc.name or default
    if not title_text:
        title_text = doc.name or "Quarterly Systems Report"

    # Build the hierarchical tree of headings for toc.json
    root_sections = []
    current_l1 = None
    current_l2 = None

    l1_count = 0
    for h in headings:
        node = {
            "title": h["title"],
            "level": h["level"],
            "anchor": h["anchor"],
            "page_no": h["page_no"],
            "children": []
        }
        
        if h["level"] == 1:
            l1_count += 1
            nn = f"{l1_count:02d}"
            node["filename"] = f"sections/{nn}-{h['anchor']}.md"
            root_sections.append(node)
            current_l1 = node
            current_l2 = None
        elif h["level"] == 2:
            if current_l1 is not None:
                current_l1["children"].append(node)
                current_l2 = node
            else:
                root_sections.append(node)
                current_l2 = node
        elif h["level"] == 3:
            if current_l2 is not None:
                current_l2["children"].append(node)
            elif current_l1 is not None:
                current_l1["children"].append(node)
            else:
                root_sections.append(node)

    # Save output/toc.json
    toc_data = {
        "title": title_text,
        "sections": root_sections
    }
    with open("output/toc.json", "w", encoding="utf-8") as f:
        json.dump(toc_data, f, indent=2, ensure_ascii=False)

    # Group elements by H1 section for generating section files
    h1_groups = []
    current_group = None

    for item, _ in doc.iterate_items():
        text = getattr(item, "text", "").strip()
        if not text:
            continue
        
        match = heading_regex.match(text)
        if match:
            outline_num = match.group(1)
            level = len(outline_num.split('.'))
            if level == 1:
                current_group = {
                    "h1_title": text,
                    "elements": []
                }
                h1_groups.append(current_group)
                
            if current_group is not None:
                current_group["elements"].append({
                    "type": "heading",
                    "text": text,
                    "level": level
                })
        else:
            if current_group is not None:
                current_group["elements"].append({
                    "type": "body",
                    "text": text
                })

    # Generate section files
    for i, group in enumerate(h1_groups):
        nn = f"{i+1:02d}"
        h1_slug = slug(group["h1_title"])
        filename = f"output/sections/{nn}-{h1_slug}.md"
        
        content_parts = []
        for el in group["elements"]:
            if el["type"] == "heading":
                content_parts.append("#" * el["level"] + " " + el["text"])
            elif el["type"] == "body":
                content_parts.append(el["text"])
                
        # Generate relative links
        links = []
        links.append("[Index](../index.md)")
        
        if i > 0:
            prev_group = h1_groups[i-1]
            prev_nn = f"{i:02d}"
            prev_slug = slug(prev_group["h1_title"])
            prev_filename = f"{prev_nn}-{prev_slug}.md"
            links.append(f"[Previous]({prev_filename})")
            
        if i < len(h1_groups) - 1:
            next_group = h1_groups[i+1]
            next_nn = f"{i+2:02d}"
            next_slug = slug(next_group["h1_title"])
            next_filename = f"{next_nn}-{next_slug}.md"
            links.append(f"[Next]({next_filename})")
            
        markdown_text = "\n\n".join(content_parts) + "\n\n" + " | ".join(links) + "\n"
        
        with open(filename, "w", encoding="utf-8") as f:
            f.write(markdown_text)

    # Generate output/index.md
    index_lines = []
    for i, group in enumerate(h1_groups):
        nn = f"{i+1:02d}"
        h1_slug = slug(group["h1_title"])
        target = f"sections/{nn}-{h1_slug}.md"
        index_lines.append(f"- [{group['h1_title']}]({target})")
        
    index_content = "\n".join(index_lines) + "\n"
    with open("output/index.md", "w", encoding="utf-8") as f:
        f.write(index_content)

    print("Generation completed successfully!")

if __name__ == "__main__":
    main()
