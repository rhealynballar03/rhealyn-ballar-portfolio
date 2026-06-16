# Trend Finder API — /api/trending?q=<topic>  (Vercel Python serverless function)
# Merges three real public sources (Google News RSS, Reddit search RSS,
# Hacker News via Algolia) round-robin and returns the top 5 as JSON.
# No API key required.
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urljoin
from concurrent.futures import ThreadPoolExecutor
import json
import requests
from bs4 import BeautifulSoup

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"


def fetch_og_image(page_url):
    if not page_url:
        return None
    try:
        resp = requests.get(page_url, headers={"User-Agent": UA}, timeout=3)
        if not resp.ok:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        for name, attrs in (
            ("meta", {"property": "og:image"}),
            ("meta", {"name": "og:image"}),
            ("meta", {"name": "twitter:image"}),
            ("meta", {"property": "twitter:image"}),
        ):
            tag = soup.find(name, attrs=attrs)
            if tag and tag.get("content"):
                return urljoin(page_url, tag["content"])
        return None
    except Exception:
        return None


def _gnews_results(query):
    out = []
    try:
        resp = requests.get(
            GOOGLE_NEWS_RSS,
            params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
            headers={"User-Agent": UA}, timeout=8)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "xml")
        for item in soup.find_all("item"):
            title_el, link_el, src_el = item.find("title"), item.find("link"), item.find("source")
            if not title_el or not link_el:
                continue
            title = title_el.get_text(strip=True)
            source = src_el.get_text(strip=True) if src_el else "Google News"
            if source and title.endswith(" - " + source):
                title = title[: -(len(source) + 3)].strip()
            out.append({"title": title, "link": link_el.get_text(strip=True),
                        "source": source or "Google News", "thumbnail": None,
                        "_imgsrc": (src_el.get("url") if src_el else None)})
    except Exception:
        pass
    return out


def _reddit_results(query):
    out = []
    try:
        resp = requests.get("https://www.reddit.com/search.rss",
                            params={"q": query, "limit": 10, "sort": "relevance"},
                            headers={"User-Agent": UA}, timeout=8)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "xml")
        for entry in soup.find_all("entry"):
            title_el, link_el = entry.find("title"), entry.find("link")
            if not title_el or not link_el:
                continue
            link = link_el.get("href") or ""
            cat = entry.find("category")
            sub = cat.get("label") if cat and cat.get("label") else None
            thumb = None
            media = entry.find("thumbnail")
            if media and media.get("url"):
                thumb = media.get("url")
            if not thumb:
                content = entry.find("content")
                if content:
                    img = BeautifulSoup(content.get_text(), "html.parser").find("img")
                    if img and img.get("src"):
                        thumb = img.get("src")
            out.append({"title": title_el.get_text(strip=True), "link": link,
                        "source": ("Reddit · " + sub) if sub else "Reddit",
                        "thumbnail": thumb, "_imgsrc": link})
    except Exception:
        pass
    return out


def _hn_results(query):
    out = []
    try:
        resp = requests.get("https://hn.algolia.com/api/v1/search",
                            params={"query": query, "tags": "story", "hitsPerPage": 10},
                            headers={"User-Agent": UA}, timeout=8)
        resp.raise_for_status()
        for hit in resp.json().get("hits", []):
            title = hit.get("title")
            if not title:
                continue
            article = hit.get("url")
            link = article or ("https://news.ycombinator.com/item?id=" + str(hit.get("objectID")))
            out.append({"title": title, "link": link, "source": "Hacker News",
                        "thumbnail": None, "_imgsrc": article or link})
    except Exception:
        pass
    return out


def _interleave(lists, limit):
    merged, seen, i = [], set(), 0
    while len(merged) < limit:
        advanced = False
        for lst in lists:
            if i < len(lst):
                advanced = True
                item = lst[i]
                if item["link"] and item["link"] not in seen:
                    seen.add(item["link"])
                    merged.append(item)
                    if len(merged) >= limit:
                        break
        if not advanced:
            break
        i += 1
    return merged


def build(query):
    with ThreadPoolExecutor(max_workers=3) as pool:
        g = pool.submit(_gnews_results, query)
        r = pool.submit(_reddit_results, query)
        h = pool.submit(_hn_results, query)
        gnews, reddit, hn = g.result(), r.result(), h.result()
    results = _interleave([gnews, reddit, hn], 5)

    need = [r for r in results if not r.get("thumbnail") and r.get("_imgsrc")]
    if need:
        with ThreadPoolExecutor(max_workers=5) as pool:
            imgs = list(pool.map(lambda r: fetch_og_image(r["_imgsrc"]), need))
        for r, img in zip(need, imgs):
            if img:
                r["thumbnail"] = img

    for r in results:
        if not r.get("thumbnail"):
            host = ""
            for cand in (r.get("_imgsrc"), r.get("link")):
                if cand:
                    host = urlparse(cand).hostname or ""
                    if host:
                        break
            if host:
                r["thumbnail"] = "https://www.google.com/s2/favicons?domain=" + host + "&sz=128"
        r.pop("_imgsrc", None)
    return {"query": query, "results": results}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = (parse_qs(urlparse(self.path).query).get("q", [""])[0]).strip()
        if not query:
            return self._send(400, {"error": "Missing search query"})
        try:
            self._send(200, build(query))
        except Exception as e:
            self._send(500, {"error": str(e)})

    def do_OPTIONS(self):
        self._send(204, None)

    def _send(self, code, obj):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if obj is not None:
            body = json.dumps(obj).encode("utf-8")
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "s-maxage=300, stale-while-revalidate=600")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.end_headers()
