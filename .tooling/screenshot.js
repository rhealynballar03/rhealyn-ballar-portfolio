// Capture screenshots of live project pages with Puppeteer.
// Run from .tooling:  node screenshot.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8000';
const OUT = path.join(__dirname, '..', 'assets', 'shots');

// project page -> output slug + label
const PAGES = [
  { slug: '01-smart-watch',   url: '/projects/smart-watch/index.html',          label: 'Tester · Smart Watch Pro' },
  { slug: '02-sights',        url: '/projects/smart-watch/Sights.html',         label: 'Sights — The Eiffel Tower', scroll: 0.35 },
  { slug: '03-tester-tech',   url: '/projects/smart-watch/TesterTech.html',     label: 'Tester Tech' },
  { slug: '04-trend-finder',  url: '/projects/smart-watch/trend-finder.html',   label: 'Trend Finder' },
  { slug: '05-dashboard',     url: '/projects/smart-watch/dashboard.html',      label: 'Submissions Dashboard' },
  { slug: '06-motion-study',  url: '/projects/smart-watch/anything.html',       label: 'Motion Study 001' },
  { slug: '07-moodboard',     url: '/projects/homepage-concept/Frontend.html',  label: 'Moodboard — Homepage Concept Generator' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const results = [];

  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
    try {
      await page.goto(BASE + p.url, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (e) {
      // fall back to domcontentloaded if networkidle times out (video pages)
      await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
    }
    await sleep(3500); // let fonts, hero animations, and video frames settle

    if (p.scroll) {
      await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), p.scroll);
      await sleep(2500);
    }

    // measure how much real content rendered
    const info = await page.evaluate(() => ({
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().length,
      imgs: document.images.length,
      h: document.body.scrollHeight,
    }));

    const file = path.join(OUT, p.slug + '.png');
    await page.screenshot({ path: file, type: 'png' });
    const bytes = fs.statSync(file).size;
    results.push({ ...p, ...info, bytes });
    console.log(`shot ${p.slug.padEnd(18)} text=${String(info.text).padStart(5)}  imgs=${String(info.imgs).padStart(3)}  ${(bytes/1024).toFixed(0)}KB`);
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(results, null, 2));
  console.log('\nDone -> ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
