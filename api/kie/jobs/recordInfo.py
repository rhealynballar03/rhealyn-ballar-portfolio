# kie.ai proxy — GET /api/kie/jobs/recordInfo?taskId=...  (Vercel Python serverless function)
# Polls task status server-side using the env-held key. Basic same-site guard.
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os
import json
import requests

KEY = (os.environ.get("KIE_AI_API_KEY") or "").strip()
ALLOW_HOST = (os.environ.get("ALLOW_HOST") or "rhealyn-ballar.vercel.app").strip()
KIE_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        ref = (self.headers.get("Referer") or "") + " " + (self.headers.get("Origin") or "")
        if ALLOW_HOST and ALLOW_HOST not in ref:
            return self._json(403, {"msg": "Forbidden"})
        if not KEY or KEY == "your_key_here":
            return self._json(500, {"msg": "Server API key not configured"})
        task_id = (parse_qs(urlparse(self.path).query).get("taskId", [""])[0]).strip()
        if not task_id:
            return self._json(400, {"msg": "Missing taskId"})
        try:
            r = requests.get(KIE_URL, params={"taskId": task_id},
                             headers={"Authorization": f"Bearer {KEY}"}, timeout=45)
            self._raw(r.status_code, r.content)
        except Exception as e:
            self._json(502, {"msg": str(e)})

    def do_OPTIONS(self):
        self._json(204, None)

    def _json(self, code, obj):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if obj is not None:
            b = json.dumps(obj).encode("utf-8")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b)
        else:
            self.end_headers()

    def _raw(self, code, content):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(content)
