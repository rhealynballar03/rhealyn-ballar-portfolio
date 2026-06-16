// Build a brand-consistent autoplay reel FROM the project screenshots.
// Warm ivory title card + slow Ken Burns on each shot + terracotta crossfades.
// Output: assets/reel.mp4 (+ reel-poster.jpg). Run from .tooling.
const puppeteer = require('puppeteer');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, '..', 'assets', 'shots');
const ASSETS = path.join(__dirname, '..', 'assets');
const TMP = path.join(__dirname, '_tmp');
fs.mkdirSync(TMP, { recursive: true });

const W = 1280, H = 800, FPS = 30, T = 0.7;
const ff = (a) => { const r = spawnSync('ffmpeg', a, { stdio: ['ignore', 'ignore', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg failed'); };

// order + per-shot hold (seconds)
const SHOTLIST = [
  { f: '01-smart-watch.png', d: 3.0 },
  { f: '02-sights.png',      d: 3.2 },
  { f: '03-tester-tech.png', d: 3.0 },
  { f: '06-motion-study.png',d: 3.0 },
  { f: '04-trend-finder.png',d: 3.0 },
  { f: '07-moodboard.png',   d: 2.8 },
].filter(s => fs.existsSync(path.join(SHOTS, s.f)));

const INTRO_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400&family=Hanken+Grotesk:wght@400;600&display=swap" rel="stylesheet">
<style>
 html,body{margin:0;width:1280px;height:800px;overflow:hidden}
 body{background:#FBF7F1;color:#2E2823;font-family:"Hanken Grotesk",sans-serif;
   display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
 .eye{display:inline-flex;align-items:center;gap:14px;font-size:18px;letter-spacing:.34em;text-transform:uppercase;color:#6E635A;font-weight:600;margin-bottom:26px}
 .dia{width:13px;height:13px;background:#C4623D;transform:rotate(45deg)}
 h1{font-family:"Fraunces",serif;font-weight:430;font-size:104px;letter-spacing:-.03em;line-height:.95;margin:0}
 .rule{width:90px;height:4px;background:#C4623D;border-radius:2px;margin:34px 0 26px}
 .sub{font-family:"Fraunces",serif;font-style:italic;font-size:30px;color:#6E635A}
 .name{position:absolute;bottom:54px;font-size:16px;letter-spacing:.28em;text-transform:uppercase;color:#6E635A;font-weight:600}
</style></head>
<body>
 <span class="eye"><span class="dia"></span>Portfolio · Selected Work</span>
 <h1>Things I've<br>built &amp; shipped</h1>
 <div class="rule"></div>
 <div class="sub">Web builds · Animation · Automation</div>
 <div class="name">Rhealyn Ballar — Virtual Assistant &amp; Web Builder</div>
</body></html>`;

(async () => {
  // 1) render brand intro card
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(INTRO_HTML, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));
  const introPng = path.join(TMP, 'intro.png');
  await page.screenshot({ path: introPng });
  await browser.close();

  // 2) per-clip temp mp4s
  const clips = [];
  const INTRO_D = 2.6;
  // intro: gentle fade, no zoom
  let p = path.join(TMP, 'c_intro.mp4');
  ff(['-y', '-loop', '1', '-t', String(INTRO_D), '-i', introPng, '-r', String(FPS),
      '-vf', `scale=${W}:${H},format=yuv420p`, '-frames:v', String(Math.round(INTRO_D * FPS)),
      '-c:v', 'libx264', '-crf', '21', p]);
  clips.push({ path: p, d: INTRO_D });

  // shots: slow Ken Burns zoom
  SHOTLIST.forEach((s, i) => {
    const out = path.join(TMP, `c_${i}.mp4`);
    const frames = Math.round(s.d * FPS);
    const vf = `scale=1920:1200:force_original_aspect_ratio=increase,crop=1920:1200,` +
      `zoompan=z='min(1+0.0009*on,1.10)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
      `format=yuv420p`;
    ff(['-y', '-loop', '1', '-t', String(s.d), '-i', path.join(SHOTS, s.f), '-r', String(FPS),
        '-vf', vf, '-frames:v', String(frames), '-c:v', 'libx264', '-crf', '21', out]);
    clips.push({ path: out, d: s.d });
  });

  // 3) xfade-concat all clips
  const args = [];
  clips.forEach(c => args.push('-i', c.path));
  const parts = [];
  clips.forEach((_, i) => parts.push(`[${i}:v]setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`));
  let last = 'v0', total = clips[0].d;
  for (let i = 1; i < clips.length; i++) {
    const offset = (total - T).toFixed(3);
    const out = (i === clips.length - 1) ? 'vout' : `x${i}`;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${T}:offset=${offset}[${out}]`);
    last = out;
    total = total + clips[i].d - T;
  }
  const reel = path.join(ASSETS, 'reel.mp4');
  ff([...args, '-filter_complex', parts.join(';'), '-map', '[vout]',
      '-r', String(FPS), '-c:v', 'libx264', '-profile:v', 'high', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', reel]);

  // 4) poster (first shot, ~3.2s in past the intro)
  ff(['-y', '-i', reel, '-ss', '3.4', '-frames:v', '1', '-update', '1', '-q:v', '3',
      path.join(ASSETS, 'reel-poster.jpg')]);

  // cleanup temps
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`reel.mp4 ${(fs.statSync(reel).size / 1024).toFixed(0)}KB  ~${total.toFixed(1)}s  (${clips.length} clips)`);
})().catch(e => { console.error(e); process.exit(1); });
