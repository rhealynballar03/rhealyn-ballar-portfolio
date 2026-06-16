// app.js — homepage concept generator wired to the kie.ai image API.
// Concept TEXT is generated locally (no second API). Only IMAGES hit kie.ai.
// Inputs + generated concepts (text and image URLs) are persisted to
// localStorage and restored automatically on page load.
// Loads after config.js, which defines: const CONFIG = { KIE_AI_API_KEY: "..." }

"use strict";

/* ----------------------------------------------------------------------------
 * kie.ai configuration
 * ------------------------------------------------------------------------- */

// Swap this one constant to use a different kie.ai image model.
const MODEL = "nano-banana-pro";

// Routed through the serverless proxy (/api/kie/*) which holds the kie.ai key
// server-side, so the key is never exposed in the browser. The Authorization
// header is added by the proxy — not here.
const KIE_BASE = "/api/kie";

const ASPECT_RATIO = "16:9";   // desktop homepage feel
const RESOLUTION = "1K";
const OUTPUT_FORMAT = "png";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000; // 2 minutes per image
const MAX_CONCURRENCY = 4;       // simultaneous in-flight image jobs

const PLACEHOLDER_KEY = "PASTE_YOUR_KIE_AI_KEY_HERE";

const STORAGE_KEY = "homepageConcepts.v1";

/* ----------------------------------------------------------------------------
 * Persistent state
 * ------------------------------------------------------------------------- */

// Single source of truth, mirrored to localStorage by persist().
let currentInputs = { idea: "", theme: "", products: "" };
let currentConcepts = []; // each gains frontUrl / backUrl as images resolve

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, inputs: currentInputs, concepts: currentConcepts })
    );
  } catch (e) {
    // Storage can fail (quota / private mode); generation still works in-memory.
    console.warn("Could not save to localStorage:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read saved state:", e);
    return null;
  }
}

/* ----------------------------------------------------------------------------
 * Concept recipes — 3 categories, 2 variants each = 6 concepts
 * ------------------------------------------------------------------------- */

const CATEGORY_RECIPES = {
  Minimalist: {
    style:
      "minimalist design: generous whitespace, a restrained two-tone palette, " +
      "thin elegant typography, a calm aligned grid, and very few accents",
    variants: [
      { adjective: "Quiet", mood: "serene and uncluttered, almost editorial" },
      { adjective: "Pure", mood: "stark and confident, with a single accent color" },
    ],
  },
  Contemporary: {
    style:
      "contemporary design: modern trends, soft gradients, rounded cards, " +
      "tasteful micro-shadows, balanced color, expressive yet professional",
    variants: [
      { adjective: "Fluid", mood: "polished and friendly, with gentle motion cues" },
      { adjective: "Aura", mood: "premium and trend-forward, glassy surfaces" },
    ],
  },
  Dynamic: {
    style:
      "dynamic design: high contrast, oversized bold typography, striking " +
      "asymmetric layouts, vivid accent colors, energetic and attention-grabbing",
    variants: [
      { adjective: "Impact", mood: "loud and kinetic, big headlines, strong diagonals" },
      { adjective: "Voltage", mood: "electric and edgy, dark base with neon accents" },
    ],
  },
};

const CATEGORY_ORDER = ["Minimalist", "Contemporary", "Dynamic"];

/**
 * Build 6 concept objects from the shared inputs. All concepts share the same
 * idea / theme / products; only the category style + variant wording vary.
 */
function buildConcepts(idea, theme, products) {
  const concepts = [];
  let number = 1;

  for (const category of CATEGORY_ORDER) {
    const recipe = CATEGORY_RECIPES[category];

    for (const variant of recipe.variants) {
      const name = `${variant.adjective} ${titleCase(theme)}`;
      const description =
        `${category} take on "${theme}" — ${variant.mood}.`;

      const shared =
        `Website idea: ${idea}. Theme: ${theme}. ` +
        `Products / offerings featured: ${products}.`;

      const frontPrompt =
        `Design a desktop website HOMEPAGE mockup in a ${recipe.style}. ` +
        `${shared} ` +
        `Show the full above-the-fold homepage: top navigation bar, a hero ` +
        `section with a clear headline and primary call-to-action button, and ` +
        `a glimpse of the first content block. ${variant.mood}. ` +
        `Realistic high-fidelity UI, clean readable text, web design portfolio quality.`;

      const backPrompt =
        `Design the INNER CONTENT SECTIONS of the same desktop website, ` +
        `visually consistent with its homepage, in a ${recipe.style}. ` +
        `${shared} ` +
        `Show stacked sections: a features / benefits row, a product grid ` +
        `showcasing ${products}, a testimonial or social-proof block, and a ` +
        `footer with links. ${variant.mood}. ` +
        `Realistic high-fidelity UI, clean readable text, web design portfolio quality.`;

      // frontUrl / backUrl start undefined; filled in as images resolve.
      concepts.push({ number, category, name, description, frontPrompt, backPrompt });
      number += 1;
    }
  }

  return concepts;
}

function titleCase(str) {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/* ----------------------------------------------------------------------------
 * kie.ai client: create task -> poll -> result image URL
 * ------------------------------------------------------------------------- */

function authHeaders() {
  // No Authorization here — the /api/kie proxy injects the real key server-side.
  return { "Content-Type": "application/json" };
}

async function createTask(prompt) {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: MODEL,
      input: {
        prompt,
        aspect_ratio: ASPECT_RATIO,
        resolution: RESOLUTION,
        output_format: OUTPUT_FORMAT,
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.msg || `createTask failed (HTTP ${res.status})`);
  }
  const taskId = json.data && json.data.taskId;
  if (!taskId) throw new Error(json.msg || "createTask returned no taskId");
  return taskId;
}

async function pollTask(taskId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: authHeaders() }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.msg || `recordInfo failed (HTTP ${res.status})`);
    }

    const data = json.data || {};
    const state = data.state;

    if (state === "success") {
      let parsed = {};
      try {
        parsed = JSON.parse(data.resultJson || "{}");
      } catch (e) {
        throw new Error("Could not parse resultJson");
      }
      const url = parsed.resultUrls && parsed.resultUrls[0];
      if (!url) throw new Error("No result image URL returned");
      return url;
    }

    if (state === "fail") {
      throw new Error(data.failMsg || "Generation failed");
    }

    // waiting / queuing / generating -> keep polling
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for image");
}

async function generateImage(prompt) {
  const taskId = await createTask(prompt);
  return pollTask(taskId);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ----------------------------------------------------------------------------
 * Small concurrency-limited task runner
 * ------------------------------------------------------------------------- */

async function runWithLimit(jobs, limit) {
  let index = 0;
  async function worker() {
    while (index < jobs.length) {
      const current = index++;
      await jobs[current]();
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(limit, jobs.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
}

/* ----------------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const SIDE_LABEL = { front: "Front — Homepage", back: "Back — Inner sections" };

// Builds one image slot tied to concept[side]. Returns a slot object whose
// render(state) updates the UI. Does NOT auto-run — the caller sets the
// initial state (so we can show saved images immediately on reload).
function makeImageSlot(concept, side) {
  const urlKey = side + "Url";
  const prompt = side === "front" ? concept.frontPrompt : concept.backPrompt;

  const slot = el("div", "img-slot");
  const caption = el("div", "img-caption", SIDE_LABEL[side]);

  const slotObj = { node: slot, concept, side, urlKey, prompt };

  function render(state) {
    // state: { status: "loading" | "done" | "error", url?, message? }
    slot.innerHTML = "";
    slot.appendChild(caption);

    if (state.status === "loading") {
      const ph = el("div", "img-placeholder");
      ph.appendChild(el("div", "spinner"));
      ph.appendChild(el("span", null, "Generating…"));
      slot.appendChild(ph);
    } else if (state.status === "done") {
      const img = el("img");
      img.src = state.url;
      img.alt = SIDE_LABEL[side];
      img.loading = "lazy";
      const link = el("a", "img-link", "Open full size ↗");
      link.href = state.url;
      link.target = "_blank";
      link.rel = "noopener";
      slot.appendChild(img);
      slot.appendChild(link);
    } else {
      const err = el("div", "img-error");
      err.appendChild(el("div", null, "⚠ " + (state.message || "Failed")));
      const retry = el("button", "retry-btn", "Retry");
      retry.type = "button";
      retry.addEventListener("click", () => runSlot(slotObj));
      err.appendChild(retry);
      slot.appendChild(err);
    }
  }

  slotObj.render = render;
  return slotObj;
}

function renderConceptCard(concept) {
  const card = el("article", "concept");

  const head = el("div", "concept-head");
  head.appendChild(el("span", "concept-number", String(concept.number)));
  const titles = el("div", "concept-titles");
  titles.appendChild(el("span", "concept-category", concept.category));
  titles.appendChild(el("h2", "concept-name", concept.name));
  head.appendChild(titles);
  card.appendChild(head);

  card.appendChild(el("p", "concept-desc", concept.description));

  const images = el("div", "concept-images");
  const front = makeImageSlot(concept, "front");
  const back = makeImageSlot(concept, "back");
  images.appendChild(front.node);
  images.appendChild(back.node);
  card.appendChild(images);

  return { card, slots: [front, back] };
}

// Run a single image slot to completion, persisting the URL on success.
async function runSlot(slot) {
  slot.render({ status: "loading" });
  try {
    const url = await generateImage(slot.prompt);
    slot.concept[slot.urlKey] = url; // mutate the persisted concept object
    persist();
    slot.render({ status: "done", url });
  } catch (e) {
    slot.render({ status: "error", message: e.message });
  }
}

// Set a slot's initial display from any saved URL (used on reload).
function renderSlotFromSaved(slot) {
  const savedUrl = slot.concept[slot.urlKey];
  if (savedUrl) {
    slot.render({ status: "done", url: savedUrl });
  } else {
    slot.render({ status: "error", message: "Not generated — click Retry" });
  }
}

/* ----------------------------------------------------------------------------
 * Click handler
 * ------------------------------------------------------------------------- */

function showFormError(message) {
  const box = document.getElementById("formError");
  if (!box) return;
  box.textContent = message;
  box.style.display = message ? "block" : "none";
}

async function handleGenerate() {
  const idea = document.getElementById("idea").value.trim();
  const theme = document.getElementById("theme").value.trim();
  const products = document.getElementById("products").value.trim();

  if (!idea || !theme || !products) {
    showFormError("Please fill in Idea, Theme, and Products before generating.");
    return;
  }

  if (
    typeof CONFIG === "undefined" ||
    !CONFIG.KIE_AI_API_KEY ||
    CONFIG.KIE_AI_API_KEY === PLACEHOLDER_KEY
  ) {
    showFormError(
      "Your kie.ai API key isn't set. Open config.js and replace the placeholder with your real key."
    );
    return;
  }

  showFormError("");

  const btn = document.getElementById("generateBtn");
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Generating…";

  // New run: replace state and save inputs + fresh concepts right away.
  currentInputs = { idea, theme, products };
  currentConcepts = buildConcepts(idea, theme, products);
  persist();

  const results = document.getElementById("results");
  results.innerHTML = "";

  // 1) Render all 6 cards immediately with loading placeholders.
  const allSlots = [];
  for (const concept of currentConcepts) {
    const { card, slots } = renderConceptCard(concept);
    results.appendChild(card);
    for (const slot of slots) {
      slot.render({ status: "loading" });
      allSlots.push(slot);
    }
  }

  // 2) Kick off all 12 image jobs with a concurrency cap. Each persists on success.
  const jobs = allSlots.map((slot) => () => runSlot(slot));
  await runWithLimit(jobs, MAX_CONCURRENCY);

  btn.disabled = false;
  btn.textContent = originalLabel;
}

/* ----------------------------------------------------------------------------
 * Download displayed designs as a standalone .html file
 * ------------------------------------------------------------------------- */

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(str) {
  return String(str || "designs")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "designs";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Best-effort: embed the image as a data URL so the file works offline.
// Falls back to the remote URL if the fetch is blocked (CORS) or fails.
async function resolveImageSrc(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch (e) {
    console.warn("Could not embed image, linking remotely instead:", url, e);
    return url;
  }
}

function imageBlock(label, src) {
  if (src) {
    return (
      `<figure class="img"><figcaption>${escapeHtml(label)}</figcaption>` +
      `<img src="${escapeHtml(src)}" alt="${escapeHtml(label)}"></figure>`
    );
  }
  return (
    `<figure class="img"><figcaption>${escapeHtml(label)}</figcaption>` +
    `<div class="missing">Not generated</div></figure>`
  );
}

// concepts: array with resolved .frontSrc / .backSrc strings
function buildStandaloneHtml(inputs, concepts) {
  const cards = concepts
    .map(
      (c) => `
    <article class="concept">
      <div class="head">
        <span class="num">${escapeHtml(c.number)}</span>
        <div>
          <span class="cat">${escapeHtml(c.category)}</span>
          <h2 class="name">${escapeHtml(c.name)}</h2>
        </div>
      </div>
      <p class="desc">${escapeHtml(c.description)}</p>
      <div class="images">
        ${imageBlock("Front — Homepage", c.frontSrc)}
        ${imageBlock("Back — Inner sections", c.backSrc)}
      </div>
    </article>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Homepage Concepts — ${escapeHtml(inputs.theme || "Designs")}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f5f5f7; color: #1d1d1f; }
  header { background: #1d1d1f; color: #fff; padding: 24px 32px; }
  header h1 { margin: 0 0 10px; font-size: 1.6rem; }
  header .meta { font-size: 0.9rem; color: #cfcfd4; line-height: 1.5; }
  header .meta b { color: #fff; }
  .results { max-width: 1100px; margin: 32px auto 60px; padding: 0 24px;
             display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
  @media (max-width: 760px) { .results { grid-template-columns: 1fr; } }
  .concept { background: #fff; border: 1px solid #e2e2e7; border-radius: 14px; padding: 20px;
             box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .num { flex: 0 0 auto; width: 36px; height: 36px; display: flex; align-items: center;
         justify-content: center; background: #1d1d1f; color: #fff; border-radius: 50%; font-weight: 700; }
  .cat { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #0071e3; }
  .name { margin: 2px 0 0; font-size: 1.2rem; }
  .desc { margin: 0 0 16px; color: #555; font-size: 0.92rem; line-height: 1.4; }
  .images { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 480px) { .images { grid-template-columns: 1fr; } }
  .img figcaption { font-size: 0.75rem; font-weight: 600; color: #6e6e73; margin-bottom: 6px; }
  .img { margin: 0; }
  .img img { width: 100%; border-radius: 8px; display: block; border: 1px solid #e2e2e7; }
  .missing { aspect-ratio: 16 / 9; border: 1px dashed #c7c7cc; border-radius: 8px; background: #fafafa;
             display: flex; align-items: center; justify-content: center; color: #6e6e73; font-size: 0.85rem; }
</style>
</head>
<body>
  <header>
    <h1>Homepage Concepts</h1>
    <div class="meta">
      <div><b>Idea:</b> ${escapeHtml(inputs.idea)}</div>
      <div><b>Theme:</b> ${escapeHtml(inputs.theme)}</div>
      <div><b>Products:</b> ${escapeHtml(inputs.products)}</div>
    </div>
  </header>
  <section class="results">
${cards}
  </section>
</body>
</html>`;
}

async function handleDownload() {
  if (!currentConcepts.length) {
    showFormError("Nothing to download yet — generate some designs first.");
    return;
  }
  showFormError("");

  const btn = document.getElementById("downloadBtn");
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Preparing…";

  try {
    // Resolve every image to an embeddable src (data URL where possible).
    const resolved = await Promise.all(
      currentConcepts.map(async (c) => ({
        number: c.number,
        category: c.category,
        name: c.name,
        description: c.description,
        frontSrc: await resolveImageSrc(c.frontUrl),
        backSrc: await resolveImageSrc(c.backUrl),
      }))
    );

    const html = buildStandaloneHtml(currentInputs, resolved);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `homepage-concepts-${slugify(currentInputs.theme)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    showFormError("Could not build the download file: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/* ----------------------------------------------------------------------------
 * Restore on load
 * ------------------------------------------------------------------------- */

function restoreFromStorage() {
  const state = loadState();
  if (!state) return;

  currentInputs = state.inputs || currentInputs;
  currentConcepts = Array.isArray(state.concepts) ? state.concepts : [];

  // Restore the input fields.
  setInputValue("idea", currentInputs.idea);
  setInputValue("theme", currentInputs.theme);
  setInputValue("products", currentInputs.products);

  if (!currentConcepts.length) return;

  // Re-render saved concept cards with their saved images.
  const results = document.getElementById("results");
  results.innerHTML = "";
  for (const concept of currentConcepts) {
    const { card, slots } = renderConceptCard(concept);
    results.appendChild(card);
    for (const slot of slots) renderSlotFromSaved(slot);
  }
}

function setInputValue(id, value) {
  const node = document.getElementById(id);
  if (node && typeof value === "string") node.value = value;
}

document.addEventListener("DOMContentLoaded", () => {
  restoreFromStorage();

  const btn = document.getElementById("generateBtn");
  if (btn) btn.addEventListener("click", handleGenerate);

  const dlBtn = document.getElementById("downloadBtn");
  if (dlBtn) dlBtn.addEventListener("click", handleDownload);

  // Autosave inputs as they're typed, so even un-generated text survives refresh.
  for (const id of ["idea", "theme", "products"]) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.addEventListener("input", () => {
      currentInputs[id] = node.value;
      persist();
    });
  }
});
