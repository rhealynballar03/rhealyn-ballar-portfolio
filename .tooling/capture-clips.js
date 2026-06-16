// Record scroll-through motion clips of live project pages with Puppeteer.
// Captures the real animation (e.g. Sights' scroll-driven Eiffel transform).
// Run from .tooling:  node capture-clips.js            (all)
//                     node capture-clips.js sights      (filter by slug substring)
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8000';
const OUT = path.join(__dirname, '..', 'assets', 'clips');

// scrollMs = wall-clock time spent scrolling top->bottom (slower = smoother motion)
const PAGES = [
  { slug: '01-smart-watch',  url: '/projects/smart-watch/index.html',         scrollMs: 6000, hold: 1200 },
  { slug: '02-sights',       url: '/projects/smart-watch/Sights.html',        scrollMs: 9000, hold: 1500 },
  { slug: '03-tester-tech',  url: '/projects/smart-watch/TesterTech.html',    scrollMs: 6500, hold: 1000 },
  { slug: '04-trend-finder', url: '/projects/smart-watch/trend-finder.html',  scrollMs: 5000, hold: 1000 },
  { slug: '06-motion-study', url: '/projects/smart-watch/anything.html',      scrollMs: 6000, hold: 1500 },
  { slug: '07-moodboard',    url: '/projects/homepage-concept/Frontend.html', scrollMs: 3500, hold: 1000 },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const filter = process.argv[2];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const list = PAGES.filter(p => !filter || p.slug.includes(filter));

  for (const p of list) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    try { await page.goto(BASE + p.url, { waitUntil: 'networkidle2', timeout: 45000 }); }
    catch { await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{}); }
    await sleep(2500); // settle fonts / hero / first frames

    const webm = path.join(OUT, p.slug + '.webm');
    const recorder = await page.screencast({ path: webm });

    // open with a brief hold on the hero, then smooth-scroll to the bottom, then hold
    await sleep(p.hold);
    const maxScroll = await page.evaluate(() => Math.max(0, document.body.scrollHeight - window.innerHeight));
    const steps = Math.max(20, Math.round(p.scrollMs / 80));
    for (let i = 1; i <= steps; i++) {
      const y = Math.round(maxScroll * (i / steps));
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await sleep(p.scrollMs / steps);
    }
    await sleep(p.hold);

    await recorder.stop();
    const kb = (fs.statSync(webm).size / 1024).toFixed(0);
    console.log(`clip ${p.slug.padEnd(16)} maxScroll=${String(maxScroll).padStart(6)}  ${kb}KB`);
    await page.close();
  }

  await browser.close();
  console.log('\nDone -> ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
