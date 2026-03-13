import sys
import json
import os
import pdfplumber
import re
import requests

def smart_join_lines(text):
    # First, handle hyphenated words
    text = re.sub(r'(\w+)-\s*\r?\n\s*(\w+)', r'\1\2', text)
    # Handle line breaks in the middle of sentences
    # Line ends with lowercase or punctuation that isn't sentence-ending
    text = re.sub(r'([a-z,;:()])\s*\r?\n\s*([a-z])', r'\1 \2', text)
    # Handle cases where previous line ends mid-sentence with no punctuation
    text = re.sub(r'(\S)\s*\r?\n\s*([a-z])', r'\1 \2', text)
    # Clean up any multiple spaces
    text = re.sub(r' +', ' ', text)
    return text

def extract_text_regions(pdf_path, regions):
    """
    Extracts text from specified regions of a PDF file.

    :param pdf_path: Path to the PDF file.
    :param regions: A JSON string mapping page numbers to a list of regions.
                    Example: '{"1": [[0.1, 0.1, 0.5, 0.9]]}'
                    Each region is [left, top, right, bottom] boundry values as ratios of visible page dimensions.
    :return: A dictionary with success status, extracted text, and total page count.
    """
    try:
        regions_by_page = json.loads(regions)
        page_texts = []
        total_pages = 0
        first_block = True
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                page_number_str = str(i + 1)  # User-provided page numbers are 1-based
                if page_number_str in regions_by_page:
                    page_region_texts = []
                    for region in regions_by_page[page_number_str]:
                        visible = page.crop(page.cropbox)
                        vX0, vY0, vX1, vY1 = visible.bbox
                        x0, y0, x1, y1 = region
                        bbox = (vX0 + x0*(vX1-vX0), vY0 + y0*(vY1-vY0),
                                vX0 + x1*(vX1-vX0), vY0 + y1*(vY1-vY0))
                        text = page.within_bbox(bbox).extract_text()
                        if not text:
                            continue

                        # Clear leading and trailing whitespaces and newline characters in text
                        clean_text = text.strip()
                        # Remove all tabs
                        clean_text = re.sub(r'\t', ' ', clean_text)
                        # Remove multiple spaces
                        clean_text = re.sub(r'[^\S\r\n]+', ' ', clean_text)
                        # Join split sentences
                        clean_text = smart_join_lines(clean_text)

                        if not clean_text:
                            continue

                        label='Information'
                        if first_block:
                            label='Document'
                            first_block = False

                        block_data = { "page": int(page_number_str)}
                        text_to_append = f"(:{label} {json.dumps(block_data)})\n{clean_text}"
                        page_region_texts.append(text_to_append)
                    
                    if page_region_texts:
                        page_texts.append("\n\n".join(page_region_texts))

        raw_text = "\n\n".join(page_texts)

        return {
            "success": True,
            "text": raw_text,
            "pages": total_pages
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "PDF path and page regions required"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    regions_input = sys.argv[2]

    if os.path.isfile(regions_input):
        with open(regions_input, 'r') as f:
            regions = f.read()
    else:
        regions = regions_input

    print(json.dumps(extract_text_regions(pdf_path, regions)))
