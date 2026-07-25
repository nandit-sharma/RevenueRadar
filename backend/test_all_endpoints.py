import urllib.request
import json

BASE = "http://localhost:8000/api"

endpoints = [
    "/upload-status",
    "/kpis",
    "/revenue-by-location",
    "/revenue-by-cuisine",
    "/revenue-trend",
    "/top-entities",
    "/filters/options",
    "/correlation",
    "/drivers",
    "/seasonal-patterns",
    "/forecast",
    "/alerts",
    "/dataset/schema",
    "/dataset/rows?page=1&limit=5",
]

def test_all():
    print("Testing all backend endpoints on http://localhost:8000...")
    for ep in endpoints:
        url = BASE + ep
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = resp.read().decode('utf-8')
                print(f"[OK] {ep} -> Status {resp.status} (Length: {len(data)})")
        except Exception as e:
            print(f"[FAIL] {ep} -> Error: {e}")

if __name__ == '__main__':
    test_all()
