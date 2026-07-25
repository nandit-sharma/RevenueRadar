import urllib.request
import time

url = "http://localhost:8000/api/kpis"
start = time.time()
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = resp.read().decode('utf-8')
        elapsed = time.time() - start
        print(f"[OK] /kpis in {elapsed:.3f}s -> {data}")
except Exception as e:
    print(f"[FAIL] /kpis Error: {e}")
