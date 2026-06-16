/* ============================================================
   cart.js — shared cart engine for the Tester Tech storefront.
   - localStorage-backed store (key: tester_cart)
   - injects a persistent header cart button + count badge
   - builds a slide-in cart drawer + toast
   - wires storefront buttons: Add to Cart adds; Buy Now / Explore
     navigate to the product detail page
   Exposes window.TesterCart.
   ============================================================ */
(function (w, d) {
  "use strict";
  var KEY = "tester_cart";
  var slug = w.ttSlug || function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
  var CATALOG = w.TT_CATALOG || {};

  /* ---------- store ---------- */
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function write(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} broadcast(); }
  function count() { return read().reduce(function (n, it) { return n + (it.qty || 0); }, 0); }
  function subtotal() { return read().reduce(function (s, it) { return s + (it.price || 0) * (it.qty || 0); }, 0); }

  function add(item, qty) {
    qty = qty || 1;
    var items = read();
    var found = items.filter(function (it) { return it.id === item.id; })[0];
    if (found) { found.qty += qty; }
    else { items.push({ id: item.id, name: item.name, price: item.price, qty: qty }); }
    write(items);
  }
  function setQty(id, qty) {
    var items = read().map(function (it) { return it.id === id ? Object.assign({}, it, { qty: qty }) : it; })
      .filter(function (it) { return it.qty > 0; });
    write(items);
  }
  function remove(id) { write(read().filter(function (it) { return it.id !== id; })); }
  function clear() { write([]); }

  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function media(id) {
    var p = CATALOG[id];
    if (p && p.img) return '<img src="' + p.img + '" alt="" onerror="this.style.display=\'none\'" />';
    return '<span aria-hidden="true">' + ((p && p.glyph) || "▦") + "</span>";
  }

  /* ---------- subscribers ---------- */
  var subs = [];
  function onChange(cb) { subs.push(cb); cb(); }
  function broadcast() { subs.forEach(function (cb) { try { cb(); } catch (e) {} }); }

  /* ---------- toast ---------- */
  var toastEl, toastMsg, toastTimer;
  function buildToast() {
    toastEl = d.createElement("div");
    toastEl.className = "cd-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg><span></span>';
    toastMsg = toastEl.querySelector("span");
    d.body.appendChild(toastEl);
  }
  function toast(msg) {
    if (!toastEl) buildToast();
    toastMsg.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  /* ---------- drawer ---------- */
  var overlay, drawer, bodyEl, footEl;
  function buildDrawer() {
    overlay = d.createElement("div"); overlay.className = "cd-overlay";
    drawer = d.createElement("aside"); drawer.className = "cd"; drawer.setAttribute("aria-label", "Shopping cart"); drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<div class="cd__head"><div class="cd__title">Your cart <span class="cd-n"></span></div>' +
      '<button class="cd__close" aria-label="Close cart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="cd__body"></div>' +
      '<div class="cd__foot"></div>';
    d.body.appendChild(overlay);
    d.body.appendChild(drawer);
    bodyEl = drawer.querySelector(".cd__body");
    footEl = drawer.querySelector(".cd__foot");
    overlay.addEventListener("click", closeDrawer);
    drawer.querySelector(".cd__close").addEventListener("click", closeDrawer);
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
    bodyEl.addEventListener("click", onDrawerClick);
    renderDrawer();
  }
  function onDrawerClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var id = el.getAttribute("data-id");
    var act = el.getAttribute("data-act");
    var item = read().filter(function (it) { return it.id === id; })[0];
    if (!item) return;
    if (act === "inc") setQty(id, item.qty + 1);
    else if (act === "dec") setQty(id, item.qty - 1);
    else if (act === "rm") remove(id);
  }
  function lineItem(it) {
    return '<div class="ci">' +
      '<div class="ci__media">' + media(it.id) + "</div>" +
      '<div><div class="ci__name">' + it.name + "</div>" +
      '<div class="ci__price">' + money(it.price) + " each</div>" +
      '<div class="ci__qty"><button data-act="dec" data-id="' + it.id + '" aria-label="Decrease quantity">−</button>' +
      "<span>" + it.qty + "</span>" +
      '<button data-act="inc" data-id="' + it.id + '" aria-label="Increase quantity">+</button></div></div>' +
      '<div class="ci__right"><div class="ci__line">' + money(it.price * it.qty) + "</div>" +
      '<button class="ci__remove" data-act="rm" data-id="' + it.id + '">Remove</button></div></div>';
  }
  function renderDrawer() {
    if (!bodyEl) return;
    var items = read();
    var n = count();
    drawer.querySelector(".cd-n").textContent = n ? "· " + n : "";
    if (!items.length) {
      bodyEl.innerHTML = '<div class="cd__empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.4a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg><p>Your cart is empty</p></div>';
      footEl.innerHTML = '<div class="cd__actions"><a class="tt-btn tt-btn--ghost tt-btn--block" href="TesterTech.html#featured">Browse products</a></div>';
      return;
    }
    bodyEl.innerHTML = items.map(lineItem).join("");
    footEl.innerHTML =
      '<div class="cd__row"><span>Subtotal</span><b>' + money(subtotal()) + "</b></div>" +
      '<div class="cd__actions">' +
      '<a class="tt-btn tt-btn--block" href="checkout.html">Checkout</a>' +
      '<a class="tt-btn tt-btn--ghost tt-btn--block" href="cart.html">View full cart</a></div>';
  }
  function openDrawer() { if (!drawer) buildDrawer(); renderDrawer(); overlay.classList.add("open"); drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); }
  function closeDrawer() { if (!drawer) return; overlay.classList.remove("open"); drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); }

  /* ---------- header cart button + count badges ---------- */
  function injectHeaderButton() {
    var navInner = d.querySelector(".tt-nav__inner");
    if (navInner && !d.querySelector(".tt-cartbtn")) {
      var btn = d.createElement("button");
      btn.className = "tt-cartbtn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Open cart");
      btn.setAttribute("data-cart-toggle", "");
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.4a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg><span class="tt-cartbtn__count" data-cart-count>0</span>';
      var cta = navInner.querySelector(".tt-cta");
      if (cta && cta.parentNode) cta.parentNode.insertBefore(btn, cta);
      else navInner.appendChild(btn);
    }
  }
  function renderBadges() {
    var n = count();
    var els = d.querySelectorAll("[data-cart-count], .tt-cartbtn__count");
    Array.prototype.forEach.call(els, function (el) {
      el.textContent = String(n);
      el.classList.toggle("show", n > 0);
    });
  }

  /* ---------- price helper from card ---------- */
  function parsePrice(txt) {
    if (!txt) return 0;
    var m = String(txt).replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  /* ---------- storefront button wiring ---------- */
  function handleButton(e) {
    var btn = e.target.closest("[data-add], .tt-card__btn");
    if (!btn) return;
    var card = btn.closest(".tt-card");
    var nameEl = card && card.querySelector(".tt-card__name");
    var txt = (btn.textContent || "").trim().toLowerCase();
    var hasAdd = btn.hasAttribute("data-add");

    var isAdd = hasAdd || txt.indexOf("add") === 0 || txt.indexOf("choose") === 0;
    var isNav = !isAdd && (txt.indexOf("buy") === 0 || txt.indexOf("explore") === 0);

    if (isAdd) {
      e.preventDefault();
      var name = btn.getAttribute("data-add") || (nameEl && nameEl.textContent.trim()) || "Item";
      var id = btn.getAttribute("data-id") || slug(name);
      var price = parsePrice(btn.getAttribute("data-price")) || parsePrice(card && card.querySelector(".tt-price") && card.querySelector(".tt-price").firstChild.textContent);
      add({ id: id, name: name, price: price });
      toast("Added " + name + " to cart");
      openDrawer();
    } else if (isNav) {
      e.preventDefault();
      var navName = (nameEl && nameEl.textContent.trim()) || btn.getAttribute("data-add");
      if (navName) w.location.href = "product-detail.html?id=" + encodeURIComponent(slug(navName));
    }
  }

  /* clicking a product's image opens its detail (features) page — so shoppers
     can look before buying. The wishlist heart and Add-to-Cart button are
     excluded so they keep their own behaviour. */
  function cardIdFrom(card) {
    var nameEl = card && card.querySelector(".tt-card__name");
    var name = nameEl && nameEl.textContent.trim();
    if (!name) return null;
    var id = slug(name);
    return CATALOG[id] ? id : null;
  }
  function handleCardNav(e) {
    var media = e.target.closest(".tt-card__media");
    if (!media || e.target.closest(".tt-fav")) return;
    var id = cardIdFrom(media.closest(".tt-card"));
    if (id) w.location.href = "product-detail.html?id=" + encodeURIComponent(id);
  }

  /* make product-card titles link to the detail page when in catalog */
  function linkCardTitles() {
    var names = d.querySelectorAll(".tt-card__name");
    Array.prototype.forEach.call(names, function (el) {
      if (el.querySelector("a")) return;
      var id = slug(el.textContent.trim());
      if (!CATALOG[id]) return;
      var a = d.createElement("a");
      a.href = "product-detail.html?id=" + id;
      a.style.color = "inherit";
      a.textContent = el.textContent;
      el.textContent = "";
      el.appendChild(a);
    });
  }

  /* ---------- wire generic toggles ---------- */
  function wireToggles() {
    d.addEventListener("click", function (e) {
      var t = e.target.closest("[data-cart-toggle]");
      if (t) { e.preventDefault(); openDrawer(); }
    });
  }

  function init() {
    injectHeaderButton();
    wireToggles();
    linkCardTitles();
    d.addEventListener("click", handleCardNav);
    d.addEventListener("click", handleButton, true);
    onChange(renderBadges);
    onChange(renderDrawer);
    // reflect changes made in other tabs
    w.addEventListener("storage", function (e) { if (e.key === KEY) broadcast(); });
  }

  w.TesterCart = {
    get: read, add: add, setQty: setQty, remove: remove, clear: clear,
    count: count, subtotal: subtotal, money: money, media: media,
    onChange: onChange, openDrawer: openDrawer, closeDrawer: closeDrawer, toast: toast
  };

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
