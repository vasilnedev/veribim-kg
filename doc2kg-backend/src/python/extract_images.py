import sys
import json
import os
import pdfplumber

def extract_images(pdf_path, output_dir, doc_id):
    images = []
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                image_filename = f"{doc_id}.{i + 1}.png"
                image_path = os.path.join(output_dir, image_filename)
                page.to_image(resolution=300).save(image_path)
                images.append(image_filename)
        return {"success": True, "images": images}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: python extract_images.py <pdf_path> <output_dir> <doc_id>"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    doc_id = sys.argv[3]
    
    print(json.dumps(extract_images(pdf_path, output_dir, doc_id)))