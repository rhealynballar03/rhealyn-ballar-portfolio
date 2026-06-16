/* ============================================================
   search.js — site-wide product search for Tester Tech.
   Self-contained: injects its own styles + a header search button,
   and opens an overlay that live-filters window.TT_CATALOG.
   Works on any page that loads catalog.js (no other dependencies).
   Press "/" to open, Esc to close, ↑/↓ to move, Enter to open a result.
   ============================================================ */
(function (w, d) {
  "use strict";
  var CATALOG = w.TT_CATALOG || {};
  var slug = w.ttSlug || function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };

  // Build a flat, searchable list once.
  var ITEMS = Object.keys(CATALOG).map(function (id) {
    var p = CATALOG[id];
    return { id: id, name: p.name, cat: p.cat || "", price: p.price || 0, glyph: p.glyph || "▦", img: p.img || "" };
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function money(n) { return "$" + Number(n).toLocaleString("en-US"); }

  /* ---------- styles (self-contained, brand colours hard-coded) ---------- */
  function injectStyles() {
    if (d.getElementById("tts-styles")) return;
    var css =
      ".tt-searchbtn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(8,7,5,.5);color:#f3ece1;cursor:pointer;flex:none;transition:color .3s,border-color .3s,transform .3s ease}" +
      ".tt-searchbtn:hover{color:#d8b981;border-color:#d8b981;transform:translateY(-2px)}" +
      ".tt-searchbtn svg{width:18px;height:18px}" +
      ".tts-overlay{position:fixed;inset:0;z-index:500;display:none;align-items:flex-start;justify-content:center;padding:14vh 1.1rem 2rem;background:rgba(4,3,2,.74);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}" +
      ".tts-overlay.open{display:flex}" +
      ".tts-panel{width:100%;max-width:600px;background:linear-gradient(165deg,#141312,#0a0908);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 30px 80px -30px rgba(0,0,0,.9);overflow:hidden}" +
      ".tts-inputwrap{display:flex;align-items:center;gap:.7rem;padding:1rem 1.1rem;border-bottom:1px solid rgba(255,255,255,.08)}" +
      ".tts-inputwrap>svg{width:19px;height:19px;color:#d8b981;flex:none}" +
      ".tts-input{flex:1;min-width:0;background:transparent;border:0;outline:none;color:#f3ece1;font-family:inherit;font-size:1.05rem}" +
      ".tts-input::placeholder{color:#8a8175}" +
      ".tts-close{flex:none;font-family:'Space Mono',ui-monospace,monospace;font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:#8a8175;background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:.3rem .5rem;cursor:pointer;transition:color .25s,border-color .25s}" +
      ".tts-close:hover{color:#d8b981;border-color:#d8b981}" +
      ".tts-results{list-style:none;margin:0;padding:.5rem;max-height:52vh;overflow-y:auto}" +
      ".tts-item{display:flex;align-items:center;gap:.85rem;padding:.65rem .7rem;border-radius:10px;cursor:pointer;text-decoration:none}" +
      ".tts-item:hover,.tts-item.active{background:rgba(216,185,129,.12)}" +
      ".tts-thumb{width:42px;height:42px;border-radius:8px;flex:none;display:grid;place-items:center;overflow:hidden;background:radial-gradient(70% 70% at 50% 35%,rgba(216,185,129,.14),transparent 60%),linear-gradient(160deg,#141312,#070605);border:1px solid rgba(255,255,255,.1);font-size:1.2rem}" +
      ".tts-thumb img{width:100%;height:100%;object-fit:cover}" +
      ".tts-meta{flex:1;min-width:0}" +
      ".tts-name{display:block;color:#f3ece1;font-size:.98rem;line-height:1.25}" +
      ".tts-cat{display:block;font-family:'Space Mono',ui-monospace,monospace;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:#8a8175;margin-top:.15rem}" +
      ".tts-price{flex:none;color:#d8b981;font-family:'Space Mono',ui-monospace,monospace;font-size:.82rem}" +
      ".tts-empty{padding:1.6rem .9rem;text-align:center;color:#8a8175;font-size:.9rem}" +
      "@media (prefers-reduced-motion: reduce){.tt-searchbtn{transition:none}}";
    var st = d.createElement("style");
    st.id = "tts-styles";
    st.textContent = css;
    d.head.appendChild(st);
  }

  /* ---------- button injection (works with both nav styles) ---------- */
  var MAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  function injectButton() {
    if (d.querySelector(".tt-searchbtn")) return;
    var btn = d.createElement("button");
    btn.className = "tt-searchbtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Search products");
    btn.innerHTML = MAG;
    btn.addEventListener("click", open);

    // Insert relative to the reference node's OWN parent — the cart button / CTA
    // may be nested inside the nav, not a direct child of it.
    var navInner = d.querySelector(".tt-nav__inner");
    if (navInner) {
      var ref = navInner.querySelector(".tt-cartbtn") || navInner.querySelector(".tt-cta");
      if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref);
      else navInner.appendChild(btn);
      return;
    }
    var links = d.querySelector(".site-header .nav-links");
    if (links) {
      var cta = links.querySelector(".nav-cta");
      if (cta && cta.parentNode) cta.parentNode.insertBefore(btn, cta);
      else links.appendChild(btn);
      return;
    }
    var header = d.querySelector(".site-header") || d.querySelector("header");
    if (header) header.appendChild(btn);
  }

  /* ---------- overlay ---------- */
  var overlay, inputEl, resultsEl, active = -1, current = [];

  function build() {
    overlay = d.createElement("div");
    overlay.className = "tts-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Product search");
    overlay.innerHTML =
      '<div class="tts-panel">' +
        '<div class="tts-inputwrap">' + MAG +
          '<input class="tts-input" type="text" placeholder="Search products…" aria-label="Search products" autocomplete="off" />' +
          '<button class="tts-close" type="button" aria-label="Close search">Esc</button>' +
        '</div>' +
        '<ul class="tts-results" role="listbox"></ul>' +
      '</div>';
    d.body.appendChild(overlay);
    inputEl = overlay.querySelector(".tts-input");
    resultsEl = overlay.querySelector(".tts-results");

    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".tts-close").addEventListener("click", close);
    inputEl.addEventListener("input", function () { render(inputEl.value); });
    inputEl.addEventListener("keydown", onKeydown);
    resultsEl.addEventListener("click", function (e) {
      var li = e.target.closest(".tts-item");
      if (li) go(li.getAttribute("data-id"));
    });
  }

  function filter(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(function (it) {
      return it.name.toLowerCase().indexOf(q) !== -1 || it.cat.toLowerCase().indexOf(q) !== -1;
    });
  }

  function render(q) {
    current = filter(q);
    active = current.length ? 0 : -1;
    if (!current.length) {
      resultsEl.innerHTML = '<li class="tts-empty">No products match “' + esc(q) + '”.</li>';
      return;
    }
    resultsEl.innerHTML = current.map(function (it, i) {
      var thumb = it.img
        ? '<span class="tts-thumb"><img src="' + esc(it.img) + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + esc(it.glyph) + '\'))"></span>'
        : '<span class="tts-thumb">' + esc(it.glyph) + '</span>';
      return '<li class="tts-item' + (i === 0 ? ' active' : '') + '" role="option" data-id="' + esc(it.id) + '">' +
        thumb +
        '<span class="tts-meta"><span class="tts-name">' + esc(it.name) + '</span><span class="tts-cat">' + esc(it.cat) + '</span></span>' +
        '<span class="tts-price">' + money(it.price) + '</span>' +
      '</li>';
    }).join("");
  }

  function setActive(i) {
    var nodes = resultsEl.querySelectorAll(".tts-item");
    if (!nodes.length) return;
    active = (i + nodes.length) % nodes.length;
    Array.prototype.forEach.call(nodes, function (n, idx) { n.classList.toggle("active", idx === active); });
    nodes[active].scrollIntoView({ block: "nearest" });
  }

  function onKeydown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (current[active]) go(current[active].id); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  }

  function go(id) { if (id) w.location.href = "product-detail.html?id=" + encodeURIComponent(id); }

  function open() {
    injectStyles();
    if (!overlay) build();
    render("");
    overlay.classList.add("open");
    d.body.style.overflow = "hidden";
    inputEl.value = "";
    setTimeout(function () { inputEl.focus(); }, 30);
  }
  function close() {
    if (!overlay) return;
    overlay.classList.remove("open");
    d.body.style.overflow = "";
  }

  /* global "/" shortcut to open search (unless typing in a field) */
  function globalKey(e) {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (typing) return;
    e.preventDefault();
    open();
  }

  function init() {
    if (!ITEMS.length) return; // no catalog on this page → nothing to search
    injectStyles();
    injectButton();
    d.addEventListener("keydown", globalKey);
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();

  w.TesterSearch = { open: open, close: close };
})(window, document);
