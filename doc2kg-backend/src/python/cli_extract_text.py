# This function is a wrapper of extract_text.py for development and testing purposes.
# It allows running the function straight from the cli instead of making an API call to documentCreateHandler.js.

from sys import argv
from extract_text import extract_text

def extract_data( filename ):
    res = extract_text( filename )
    if res['success']:
        print( res['text'] )
    else:
        print( res['error'] )

if __name__ == '__main__':
    if len(argv) != 2:
        print("Usage: python extract_data.py <filename>")
        exit(1)
    extract_data(argv[1])