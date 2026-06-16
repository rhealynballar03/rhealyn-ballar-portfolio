/* ============================================================
   catalog.js — single source of truth for Tester Tech products.
   Exposes window.TT_CATALOG (keyed by slug) and window.ttSlug().
   Used by product-detail.html and the cart engine.
   ============================================================ */
(function (w) {
  "use strict";

  function slug(name) {
    return String(name).toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // image fallbacks reuse the same Unsplash sources as the storefront cards
  var P = [
    { name: "Pulse X1", cat: "Smartphone", price: 899, rating: 4.9, count: 2140, glyph: "📱",
      img: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=80",
      desc: "A 6.7″ LTPO flagship in a titanium frame, with a triple-lens computational camera that genuinely sees in the dark.",
      feats: ["6.7″ LTPO 1–120Hz display", "Triple computational camera", "Titanium unibody", "All-day silicon-anode battery"],
      specs: { Display: "6.7″ LTPO OLED, 120Hz, 2500 nits", Chip: "Tester T1 (3nm)", Camera: "50MP + 48MP UW + 12MP tele", Battery: "5000mAh · 80W fast charge", Material: "Grade-5 titanium · Gorilla Armor", Water: "IP68" } },

    { name: "Aura Studio", cat: "Audio", price: 349, rating: 4.8, count: 3902, glyph: "🎧",
      img: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
      desc: "Over-ear headphones with adaptive noise cancelling, 40-hour battery and hi-res spatial sound tuned by ear, not by spec sheet.",
      feats: ["Adaptive noise cancelling", "40-hour battery", "Hi-res spatial audio", "Memory-foam cushions"],
      specs: { Drivers: "40mm custom dynamic", ANC: "Adaptive, 8-mic array", Battery: "40h (ANC on)", Codecs: "LDAC · aptX Adaptive", Weight: "248g", Charge: "USB-C · 5-min = 5h" } },

    { name: "Chrono Pro", cat: "Wearable", price: 399, rating: 4.9, count: 1576, glyph: "⌚",
      img: "assets/hero-watch.jpg", img2: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=1000&q=80",
      desc: "Sapphire crystal, 14-day battery and a four-channel health sensor that reads ECG, SpO₂ and skin temperature — the flagship Chrono.",
      feats: ["14-day battery life", "4-channel health sensor (ECG, SpO₂, temp)", "Sapphire crystal · titanium case", "Dual-band GPS"],
      specs: { Display: "1.4″ AMOLED, always-on, 2000 nits", Battery: "14 days typical", Sensors: "ECG · SpO₂ · temperature · HR", Material: "Grade-5 titanium · sapphire", Water: "100m (10 ATM)", Connectivity: "Dual-band GPS · BT 5.4" } },

    { name: "Spectra", cat: "Smart Glasses", price: 499, rating: 4.8, count: 612, glyph: "🕶️",
      img: "assets/smart-glasses.jpg", img2: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1000&q=80",
      desc: "A 36-gram titanium frame with a near-invisible projected display, open-ear audio and a fully on-device assistant. No phone required.",
      feats: ["Micro-projection waveguide display", "Open-ear spatial audio", "On-device assistant & translation", "36g titanium frame"],
      specs: { Display: "Monocular waveguide, 640×480", Audio: "Beam-formed open-ear", Assistant: "On-device, offline-capable", Battery: "All-day (with case)", Weight: "36g", Frame: "Grade-5 titanium" } },

    { name: "Spectra Lite", cat: "Smart Glasses · Audio", price: 279, rating: 4.6, count: 1204, glyph: "👓",
      img: "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=1000&q=80",
      desc: "Audio-first smart glasses with a 12MP capture camera and voice assistant — no display, all-day comfort.",
      feats: ["Open-ear directional audio", "12MP capture camera", "Voice assistant", "All-day battery"],
      specs: { Audio: "Open-ear, directional", Camera: "12MP photo / 1080p video", Battery: "6h playback · case top-up", Weight: "31g", Water: "IPX4" } },

    { name: "Stride Band", cat: "Wearable · Fitness", price: 129, rating: 4.7, count: 5884, glyph: "🏃",
      img: "https://images.unsplash.com/photo-1576243345690-4e4b79b63288?auto=format&fit=crop&w=1000&q=80",
      desc: "A featherweight 22g tracker with 21-day battery, sleep staging and a curved always-on display.",
      feats: ["21-day battery", "Sleep staging & recovery", "Curved AMOLED, always-on", "5 ATM water resistance"],
      specs: { Display: "1.1″ curved AMOLED", Battery: "21 days typical", Sensors: "HR · SpO₂ · sleep", Weight: "22g", Water: "5 ATM" } },

    { name: "Aria Assistant", cat: "Smart Assistant", price: 129, rating: 4.8, count: 4503, glyph: "🔊",
      img: "assets/smart-assistant.jpg", img2: "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=1000&q=80",
      desc: "Room-filling 360° sound and a private, on-device voice assistant that controls every Tester device.",
      feats: ["360° room-filling sound", "On-device private assistant", "Controls all Tester devices", "Far-field 6-mic array"],
      specs: { Speakers: "360° dual-driver", Assistant: "On-device, private", Mics: "6-mic far-field", Connectivity: "Wi-Fi 6 · BT 5.4 · Thread", Power: "AC powered" } },

    { name: "Aria Hub", cat: "Smart Assistant · Display", price: 179, oldPrice: 219, rating: 4.7, count: 2219, glyph: "🖥️",
      img: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1000&q=80",
      desc: "A 10″ control center for scenes, cameras and calls — your whole home on one calm screen.",
      feats: ["10″ touch control center", "Camera & scene control", "Video calling", "Thread border router"],
      specs: { Display: "10.1″ touch, 1280×800", Camera: "5MP, privacy shutter", Connectivity: "Wi-Fi 6 · Thread · Matter", Audio: "Stereo full-range", Power: "AC powered" } },

    { name: "Halo Ring", cat: "Connected · Wearable", price: 299, rating: 4.8, count: 903, glyph: "💍",
      img: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=80",
      desc: "A titanium sleep-and-recovery ring with 7-day battery — health tracking you forget you're wearing.",
      feats: ["7-day battery", "Sleep & recovery scoring", "Titanium, 4g", "Skin temperature trend"],
      specs: { Battery: "7 days typical", Sensors: "HR · SpO₂ · temperature", Material: "Grade-5 titanium", Weight: "4g", Water: "100m" } },

    { name: "Tag Finder", cat: "Connected · Finder", price: 29, rating: 4.9, count: 7640, glyph: "📍",
      img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1000&q=80",
      desc: "A coin-sized UWB tracker with precision finding and a year of battery — keys, bags, anything.",
      feats: ["UWB precision finding", "1-year battery", "Loud locator chime", "Community find network"],
      specs: { Radio: "UWB + BT 5.4", Battery: "12 months (CR2032)", Range: "Network-wide", Water: "IP67", Weight: "8g" } },

    { name: "Beat Pods", cat: "Audio", price: 149, rating: 4.8, count: 6210, glyph: "🎵",
      img: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=1000&q=80",
      desc: "Featherweight true-wireless earbuds with adaptive ANC and a pocketable charging case.",
      feats: ["Adaptive ANC", "Up to 30h with case", "Spatial audio", "Wireless charging case"],
      specs: { Drivers: "11mm dynamic", ANC: "Adaptive", Battery: "6h buds · 30h case", Charge: "USB-C · Qi wireless", Water: "IPX4" } },

    { name: "Frame 14", cat: "Computing", price: 1499, rating: 4.7, count: 1088, glyph: "💻",
      img: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=80",
      desc: "A 14″ machined-aluminium laptop with an all-day battery, repairable build and a stunning OLED panel.",
      feats: ["14″ OLED, 120Hz", "All-day battery", "Repairable, modular ports", "Machined aluminium"],
      specs: { Display: "14″ 3K OLED, 120Hz", Chip: "Tester C-series, 12-core", Memory: "Up to 32GB", Storage: "Up to 2TB NVMe", Battery: "18h · 100Wh", Weight: "1.3kg" } },

    { name: "Lens R6", cat: "Photography", price: 1199, rating: 4.9, count: 742, glyph: "📷",
      img: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1000&q=80",
      desc: "Full-frame mirrorless with in-body stabilisation and 4K/120 — the camera you actually bring along.",
      feats: ["Full-frame 33MP sensor", "5-axis IBIS", "4K/120 video", "Weather-sealed body"],
      specs: { Sensor: "33MP full-frame BSI", Stabilisation: "5-axis IBIS, 8 stops", Video: "4K/120 · 6K/30", AF: "Phase-detect, eye AF", Mount: "Tester RF", Weight: "560g" } },

    { name: "Echo Mini", cat: "Smart Home", price: 99, oldPrice: 129, rating: 4.6, count: 4503, glyph: "🔊",
      img: "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=1000&q=80",
      desc: "Room-filling 360° sound and an on-device voice assistant that keeps your data at home.",
      feats: ["360° sound", "On-device assistant", "Multi-room sync", "Matter hub"],
      specs: { Speaker: "360° full-range", Assistant: "On-device", Connectivity: "Wi-Fi 6 · BT · Matter", Power: "AC powered" } },

    { name: "Glide Drone", cat: "Aerial", price: 799, rating: 4.8, count: 318, glyph: "🚁",
      img: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1000&q=80",
      desc: "A foldable 4K camera drone with 34-minute flights and obstacle sensing on every axis.",
      feats: ["4K/60 stabilised camera", "34-min flight time", "Omnidirectional sensing", "Folds to pocket size"],
      specs: { Camera: "4K/60, 3-axis gimbal", Flight: "34 min", Sensing: "Omnidirectional", Range: "15km transmission", Weight: "249g" } },

    { name: "Vision VR", cat: "Gaming", price: 499, rating: 4.7, count: 205, glyph: "🥽",
      img: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&w=1000&q=80",
      desc: "Mixed-reality headset with 4K-per-eye micro-OLED and full hand tracking — no controllers required.",
      feats: ["4K per eye micro-OLED", "Full hand & eye tracking", "Colour passthrough MR", "Spatial audio"],
      specs: { Display: "4K/eye micro-OLED, 90Hz", Tracking: "Inside-out, hand + eye", Passthrough: "Full-colour", Chip: "Tester XR1", Weight: "490g" } },

    { name: "Tab S", cat: "Computing", price: 649, rating: 4.8, count: 461, glyph: "📲",
      img: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1000&q=80",
      desc: "An 11″ tablet that doubles as a sketchpad, paired with a low-latency stylus and laptop-class chip.",
      feats: ["11″ 120Hz display", "Low-latency stylus", "Laptop-class chip", "Magnetic keyboard support"],
      specs: { Display: "11″ LCD, 120Hz", Chip: "Tester T1", Stylus: "4096 levels, 9ms latency", Battery: "12h", Storage: "Up to 512GB" } },

    { name: "Grip Controller", cat: "Gaming", price: 79, rating: 4.9, count: 1012, glyph: "🎮",
      img: "https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=1000&q=80",
      desc: "Hall-effect sticks, mappable back paddles and a 50-hour charge — built for the long session.",
      feats: ["Hall-effect anti-drift sticks", "4 mappable back paddles", "50-hour battery", "Low-latency wireless"],
      specs: { Sticks: "Hall-effect", Paddles: "4, remappable", Battery: "50h", Connectivity: "2.4GHz · BT · USB-C", Weight: "280g" } },

    { name: "Type-K", cat: "Desk", price: 159, rating: 4.7, count: 880, glyph: "⌨️",
      img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
      desc: "A hot-swappable mechanical keyboard with a CNC frame and gasket mount for a softer, quieter type.",
      feats: ["Hot-swappable switches", "Gasket-mounted plate", "CNC aluminium frame", "Wireless tri-mode"],
      specs: { Layout: "75%", Switches: "Hot-swap, pre-lubed", Mount: "Gasket", Connectivity: "2.4GHz · BT · USB-C", Battery: "4000mAh" } },

    { name: "Glide Mouse", cat: "Desk", price: 69, rating: 4.7, count: 1320, glyph: "🖱️",
      img: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80",
      desc: "An ultralight 58g wireless mouse with an 8K sensor and PTFE feet that feel like air.",
      feats: ["58g ultralight", "8K Hz polling", "PTFE feet", "70-hour battery"],
      specs: { Weight: "58g", Sensor: "26K DPI, 8K polling", Switches: "Optical, 90M clicks", Battery: "70h", Connectivity: "2.4GHz · USB-C" } },

    { name: "Charge Pad", cat: "Power", price: 49, rating: 4.6, count: 2100, glyph: "🔋",
      img: "https://images.unsplash.com/photo-1591290619618-904f6dd935e3?auto=format&fit=crop&w=1000&q=80",
      desc: "A 3-in-1 magnetic pad that tops up your phone, watch and earbuds from a single cable.",
      feats: ["3-in-1 magnetic charging", "15W phone fast charge", "Watch & earbud pads", "Single USB-C cable"],
      specs: { Outputs: "Phone 15W · watch · earbuds", Standard: "Qi2 magnetic", Cable: "USB-C, 1.5m", Material: "Aluminium + silicone" } },

    { name: "Power Core 20k", cat: "Power", price: 59, rating: 4.8, count: 3400, glyph: "⚡",
      img: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=1000&q=80",
      desc: "A 20,000mAh bank with 65W USB-C output — enough to fast-charge a laptop and still fit a pocket.",
      feats: ["20,000mAh capacity", "65W USB-C PD", "Charges laptops", "Digital charge display"],
      specs: { Capacity: "20,000mAh", Output: "65W USB-C PD · 2 ports", Display: "Digital %", Charge: "In 1.5h", Weight: "356g" } },

    { name: "Chrono Lite", cat: "Wearable", price: 249, rating: 4.6, count: 1980, glyph: "⌚",
      img: "assets/hero-watch.jpg", img2: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=1000&q=80",
      desc: "The everyday Chrono — 7-day battery, heart-rate and SpO₂ in a light aluminium case.",
      feats: ["7-day battery", "Heart rate + SpO₂", "5 ATM water resistance", "Aluminium case"],
      specs: { Display: "1.3″ AMOLED, always-on", Battery: "7 days", Sensors: "HR · SpO₂", Material: "Aluminium", Water: "5 ATM" } },

    { name: "Chrono Ultra", cat: "Wearable", price: 599, rating: 4.9, count: 740, glyph: "⌚",
      img: "assets/hero-watch.jpg", img2: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=1000&q=80",
      desc: "The no-compromise Chrono — 18-day battery, dual-band GPS, LTE and 3-year Care+ included.",
      feats: ["18-day battery", "Dual-band GPS + LTE", "4-channel health sensor", "3-year Care+ included"],
      specs: { Display: "1.5″ AMOLED, 2000 nits", Battery: "18 days", Sensors: "ECG · SpO₂ · temp · HR", Connectivity: "LTE · dual-band GPS", Material: "Grade-5 titanium · sapphire", Water: "100m" } }
  ];

  var catalog = {};
  P.forEach(function (p) {
    p.id = slug(p.name);
    catalog[p.id] = p;
  });

  w.ttSlug = slug;
  w.TT_CATALOG = catalog;
})(window);
