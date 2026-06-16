# Image proxy — /api/img?url=<image-url>  (Vercel Python serverless function)
# Fetches remote thumbnails (Reddit/news/og images) server-side so they load
# without hotlink/CORS issues. Returns the image bytes with its content type.
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = (parse_qs(urlparse(self.path).query).get("url", [""])[0]).strip()
        if not url.startswith(("http://", "https://")):
            self.send_response(400)
            self.end_headers()
            return
        try:
            r = requests.get(url, headers={"User-Agent": UA, "Referer": url},
                             timeout=8)
            ct = r.headers.get("Content-Type", "")
            if not r.ok or "image" not in ct.lower():
                self.send_response(404)
                self.end_headers()
                return
            data = r.content
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, s-maxage=86400, max-age=86400")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_response(502)
            self.end_headers()
