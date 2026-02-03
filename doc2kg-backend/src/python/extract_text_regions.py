import sys
import json
import os
import pdfplumber
import re

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
                        if text:
                            page_region_texts.append(text.strip())
                    
                    if page_region_texts:
                        page_texts.append("\n".join(page_region_texts))

        raw_text = "\n\n".join(page_texts)

        # Remove word splits to new line
        raw_text = re.sub(r'-\s*\n', '', raw_text)
        # Remove all tabs
        raw_text = re.sub(r'\t', ' ', raw_text)
        # Remove multiple spaces
        raw_text = re.sub(r'[^\S\r\n]+', ' ', raw_text)

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
