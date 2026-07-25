import urllib.request
import json
import sys

def test_connection():
    url = "http://localhost:8000/health"
    print(f"Testing connection to {url}...")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = resp.read().decode('utf-8')
            print("Server responded:", resp.status, data)
            return True
    except Exception as e:
        print(f"Failed to connect to {url}: {e}")
        return False

if __name__ == '__main__':
    ok = test_connection()
    if not ok:
        sys.exit(1)
