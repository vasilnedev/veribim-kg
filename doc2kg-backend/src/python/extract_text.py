import sys
import json
import os
import pdfplumber
import spacy

def extract_text(pdf_path):
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        return {"success": False, "error": "Spacy model 'en_core_web_sm' not found. Please install it."}

    extracted_text_parts = []
    total_pages = 0

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            for page in pdf.pages:
                # Heuristic: Crop top 10% and bottom 10% of the page
                width = page.width
                height = page.height
                
                header_height = height * 0.1
                footer_height = height * 0.1
                
                text = ""
                if height > (header_height + footer_height):
                    # bbox: (x0, top, x1, bottom)
                    bbox = (0, header_height, width, height - footer_height)
                    try:
                        cropped_page = page.crop(bbox)
                        text = cropped_page.extract_text()
                    except Exception:
                        text = page.extract_text()
                else:
                    text = page.extract_text()
                
                if text:
                    extracted_text_parts.append(text)
        
        raw_text = "\n\n".join(extracted_text_parts)
        
        # Increase max_length for large documents
        if len(raw_text) > nlp.max_length:
            nlp.max_length = len(raw_text) + 100000
            
        doc = nlp(raw_text)
        # Reconstruct text: replace newlines inside sentences with space
        sentences = [sent.text.strip().replace('\n', ' ') for sent in doc.sents]
        cleaned_text = "\n\n".join(sentences)
        
        return {
            "success": True,
            "text": cleaned_text,
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