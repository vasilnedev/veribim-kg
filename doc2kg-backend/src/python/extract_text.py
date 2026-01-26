import sys
import json
import os
import pdfplumber
import re

def extract_text(pdf_path):
    try:
        extracted_text = []
        total_pages = 0
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            for page in pdf.pages:
                extracted_text.append(page.extract_text())
        raw_text = "\n\n".join(extracted_text)

        # Remove word splits to new line
        raw_text = re.sub(r'-\s*\n', '', raw_text)
        # Remove all tabs
        raw_text = re.sub(r'\t+', ' ', raw_text)
        # Remove multiple spaces
        raw_text = re.sub(r'\s+', ' ', raw_text)

        return {
            "success": True,
            "text": raw_text,
            "pages": total_pages
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "PDF path required"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    print(json.dumps(extract_text(pdf_path)))
