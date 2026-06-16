# Trend Finder API — /api/extract?url=<article-url>  (Vercel Python serverless function)
# Fetches an article and returns the ranked list of products/ideas it's about.
# PRIMARY: Google's Gemini Flash (if GEMINI_API_KEY env var is set) reads the text
#          and returns the real list, ignoring menus/ads.
# FALLBACK: HTML-structure parsing (no key needed) — used when Gemini is absent/fails.
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash").strip()
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"
GEMINI_CONFIGURED = bool(GEMINI_API_KEY) and GEMINI_API_KEY != "your_key_here"

try:
    from googlenewsdecoder import gnewsdecoder
except Exception:
    gnewsdecoder = None

_RANK_HEADING_RE = re.compile(r"^\s*#?\s*(\d{1,3})\s*[\.\)\:\-–]?\s+(.{3,})$")


def resolve_article_url(url):
    host = urlparse(url).hostname or ""
    if gnewsdecoder and host.endswith("news.google.com"):
        try:
            out = gnewsdecoder(url)
            if out and out.get("status") and out.get("decoded_url"):
                return out["decoded_url"]
        except Exception:
            pass
    return url


def extract_article(url):
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=12)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    title = ""
    og = soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        title = og["content"].strip()
    if not title and soup.title:
        title = soup.title.get_text(strip=True)
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "noscript", "svg", "iframe"]):
        tag.decompose()
    main = soup.find("article") or soup.find("main") or soup.body or soup
    chunks = [el.get_text(" ", strip=True) for el in main.find_all(["h1", "h2", "h3", "p", "li"])]
    text = "\n".join(c for c in chunks if c)
    return title, text[:30000], main


def gemini_extract_items(title, text):
    prompt = (
        "You are given the text of an online article. Identify the actual ranked list "
        "of products or ideas the article is about — for example a 'best of' / 'top N' "
        "listicle, a ranking, or the main items it discusses. IGNORE navigation menus, "
        "sidebars, advertisements, cookie notices, related-article links, newsletter "
        "prompts, and other boilerplate. Return concise item text. Preserve the article's "
        "ordering as the rank (1-based). If there is no clear list, return the article's "
        "main points as items.\n\n"
        f"ARTICLE TITLE: {title}\n\nARTICLE TEXT:\n{text}")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2, "responseMimeType": "application/json",
            "responseSchema": {"type": "object", "properties": {"items": {"type": "array",
                "items": {"type": "object", "properties": {"rank": {"type": "integer"},
                "idea": {"type": "string"}}, "required": ["rank", "idea"]}}}, "required": ["items"]}}}
    resp = None
    for attempt in range(3):
        resp = requests.post(GEMINI_URL.format(GEMINI_MODEL),
                             headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
                             json=payload, timeout=40)
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            time.sleep(1.5 * (attempt + 1))
            continue
        break
    resp.raise_for_status()
    data = resp.json()
    parts = data["candidates"][0]["content"]["parts"]
    raw = "".join(p.get("text", "") for p in parts)
    parsed = json.loads(raw)
    items = parsed.get("items", []) if isinstance(parsed, dict) else []
    cleaned = []
    for it in items:
        idea = (it.get("idea") or "").strip()
        if idea:
            cleaned.append({"rank": it.get("rank") or 0, "idea": idea})
    cleaned.sort(key=lambda x: (x["rank"] if x["rank"] else 9999))
    for i, it in enumerate(cleaned, start=1):
        it["rank"] = i
    return cleaned


def _clean_idea(text):
    return re.sub(r"\s+", " ", text or "").strip()


def _finalize_items(texts):
    out, seen = [], set()
    for t in texts:
        t = _clean_idea(t)
        if len(t) > 180:
            t = t[:177].rstrip() + "…"
        key = t.lower()
        if not t or key in seen:
            continue
        seen.add(key)
        out.append(t)
        if len(out) >= 25:
            break
    return [{"rank": i, "idea": t} for i, t in enumerate(out, start=1)]


def heuristic_extract_items(main, title=""):
    if main is None:
        return []
    numbered = []
    for h in main.find_all(["h2", "h3", "h4"]):
        m = _RANK_HEADING_RE.match(_clean_idea(h.get_text(" ", strip=True)))
        if m:
            idea = _clean_idea(m.group(2))
            if idea:
                numbered.append(idea)
    if len(numbered) >= 3:
        return _finalize_items(numbered)
    best, best_score = None, 0.0
    for lst in main.find_all(["ol", "ul"]):
        lis = lst.find_all("li", recursive=False) or lst.find_all("li")
        texts = [t for t in (_clean_idea(li.get_text(" ", strip=True)) for li in lis) if t]
        if len(texts) < 3:
            continue
        avg_len = sum(len(t) for t in texts) / len(texts)
        link_heavy = sum(1 for li in lis if li.find("a") and len(_clean_idea(li.get_text(" ", strip=True))) <= 24)
        if link_heavy > len(texts) * 0.6 and avg_len < 30:
            continue
        score = len(texts) * avg_len * (1.4 if lst.name == "ol" else 1.0)
        if score > best_score:
            best, best_score = texts, score
    if best:
        return _finalize_items(best)
    return []


def build(url):
    real_url = resolve_article_url(url)
    title, text, main = extract_article(real_url)
    items, method = [], "none"
    if GEMINI_CONFIGURED and text:
        try:
            items = gemini_extract_items(title, text)
            if items:
                method = "gemini"
        except Exception:
            items = []
    if not items:
        items = heuristic_extract_items(main, title)
        if items:
            method = "fallback"
    return {"title": title, "url": real_url, "items": items, "method": method}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = (parse_qs(urlparse(self.path).query).get("url", [""])[0]).strip()
        if not url:
            return self._send(400, {"error": "Missing url"})
        if not url.startswith(("http://", "https://")):
            return self._send(400, {"error": "url must be http(s)"})
        try:
            self._send(200, build(url))
        except Exception:
            self._send(502, {"error": "Could not fetch or read that article."})

    def do_OPTIONS(self):
        self._send(204, None)

    def _send(self, code, obj):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if obj is not None:
            body = json.dumps(obj).encode("utf-8")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.end_headers()
