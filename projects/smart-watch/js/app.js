/* ============================================================
   TESTER — Smart Watch Pro
   Minimal vanilla JS — no libraries
   (reveals, counters, video scroll-scrub, header/progress, loader)
   ============================================================ */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* Smooth anchor scrolling is handled in pure CSS via
     html { scroll-behavior: smooth } — no JS library needed. */

  /* current scroll position helper */
  const scrollY = () => window.scrollY || window.pageYOffset || 0;

  /* ---------------------------------------------------------
     2. Loader — wait for the hero video (or a timeout)
     --------------------------------------------------------- */
  function initLoader() {
    const loader = $("#loader");
    if (!loader) return;
    const bar = $(".loader-bar i");
    const pct = $(".loader-pct");
    const hero = $(".hero-video");

    let progress = 0;
    let finished = false;

    const tick = setInterval(() => {
      progress = Math.min(progress + Math.random() * 16, 92);
      if (bar) bar.style.width = progress + "%";
      if (pct) pct.textContent = Math.floor(progress) + "%";
    }, 140);

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      if (bar) bar.style.width = "100%";
      if (pct) pct.textContent = "100%";
      setTimeout(() => loader.classList.add("done"), 350);
      document.body.style.removeProperty("overflow");
    }

    document.body.style.overflow = "hidden";
    if (hero) {
      if (hero.readyState >= 3) finish();
      else hero.addEventListener("canplay", finish, { once: true });
    }
    // hard fallbacks so we never hang
    window.addEventListener("load", () => setTimeout(finish, 400));
    setTimeout(finish, 4000);
  }

  /* ---------------------------------------------------------
     3. Scroll reveals (IntersectionObserver — no CDN needed)
     --------------------------------------------------------- */
  function initReveals() {
    const items = $$(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------
     4. Count-up stats
     --------------------------------------------------------- */
  function initCounters() {
    const nums = $$(".stat-number");
    if (!nums.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      nums.forEach((el) => {
        const dec = parseInt(el.dataset.decimals || "0", 10);
        el.textContent = parseFloat(el.dataset.value).toFixed(dec);
      });
      return;
    }
    const run = (el) => {
      const target = parseFloat(el.dataset.value);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const dur = 1800;
      let start = null;
      const step = (ts) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target.toFixed(dec);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
        });
      },
      { threshold: 0.6 }
    );
    nums.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------
     5. Header state + top progress bar
     --------------------------------------------------------- */
  function initHeaderAndProgress() {
    const header = $(".site-header");
    const prog = $("#progress");
    const onScroll = () => {
      const y = scrollY();
      if (header) header.classList.toggle("scrolled", y > 40);
      if (prog) {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     6. Dissection — canvas frame renderer driven by scroll
        Pre-rendered WebP frames (FFmpeg) are drawn to a canvas;
        the frame index is bound to scroll progress through the
        .dissect runway for buttery, jank-free "video" motion.
     --------------------------------------------------------- */
  function initDissection() {
    const wrap = $(".dissect");
    const canvas = $(".dissect-canvas");
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    const callouts = $$(".callout", wrap);

    const FRAME_COUNT = 121;          // frames/frame_0001.webp … 0121
    const FRAME_SPEED = 1.18;         // >1 finishes the teardown before the end so it holds
    const IMAGE_SCALE = 0.96;         // slight inset; mask feathers the rest into black
    const framePath = (i) =>
      "frames/frame_" + String(i + 1).padStart(4, "0") + ".webp";

    const frames = new Array(FRAME_COUNT);
    let currentFrame = -1;

    function drawFrame(index, force) {
      const img = frames[index];
      if (!img) return;
      if (!force && index === currentFrame) return;
      currentFrame = index;
      const cw = canvas.width, ch = canvas.height;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
      const dw = iw * scale, dh = ih * scale;
      const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      drawFrame(currentFrame < 0 ? 0 : currentFrame, true);
    }

    // map scroll progress -> frame index + toggle callouts
    function update() {
      const total = wrap.offsetHeight - window.innerHeight;
      const rect = wrap.getBoundingClientRect();
      let p = total > 0 ? -rect.top / total : 0;
      p = Math.max(0, Math.min(1, p));
      const accelerated = Math.min(p * FRAME_SPEED, 1);
      const idx = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
      if (frames[idx]) requestAnimationFrame(() => drawFrame(idx));
      callouts.forEach((c) => {
        const a = parseFloat(c.dataset.at || "0");
        const out = parseFloat(c.dataset.out || "1");
        c.classList.toggle("show", p >= a && p <= out);
      });
    }

    function loadFrame(i) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { frames[i] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = framePath(i);
      });
    }

    // Two-phase load: first frame instantly, then the rest in the background.
    loadFrame(0).then(() => {
      resize();
      if (reduceMotion) {
        // show the final exploded view + all labels, no scroll motion
        loadFrame(FRAME_COUNT - 1).then(() => drawFrame(FRAME_COUNT - 1, true));
        callouts.forEach((c) => c.classList.add("show"));
        return;
      }
      const rest = [];
      for (let i = 1; i < FRAME_COUNT; i++) rest.push(loadFrame(i));
      Promise.all(rest).then(update);

      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", resize);
      update();
    });
  }

  /* ---------------------------------------------------------
     init
     --------------------------------------------------------- */
  function init() {
    initLoader();
    initReveals();
    initCounters();
    initHeaderAndProgress();
    initDissection();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
