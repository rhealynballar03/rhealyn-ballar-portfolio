// 1) Convert each scroll/motion webm into a web-friendly looping mp4 (card previews).
// 2) Build one autoplay reel that highlights the best moment of each project,
//    giving the Sights scroll-transformation extra time.
// Run from .tooling:  node convert-and-reel.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLIPS = path.join(__dirname, '..', 'assets', 'clips');
const PREV = path.join(__dirname, '..', 'assets', 'previews');
const ASSETS = path.join(__dirname, '..', 'assets');
fs.mkdirSync(PREV, { recursive: true });

const ff = (args) => {
  const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
};

// --- card preview clips: full clip, muted, 1000x625, looped in browser ---
const PREVIEWS = ['01-smart-watch', '02-sights', '03-tester-tech', '04-trend-finder', '06-motion-study'];
for (const slug of PREVIEWS) {
  const src = path.join(CLIPS, slug + '.webm');
  if (!fs.existsSync(src)) continue;
  const out = path.join(PREV, slug + '.mp4');
  ff(['-y', '-i', src,
      '-an',
      '-vf', 'scale=1000:625:force_original_aspect_ratio=increase,crop=1000:625,setsar=1,fps=30,format=yuv420p',
      '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-movflags', '+faststart', out]);
  console.log('preview', slug, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
}

// --- reel: highlight segment per project [start, dur] ---
const W = 1280, H = 800, T = 0.8;
const SEG = [
  { slug: '01-smart-watch',  ss: 0.4, d: 4.2 },
  { slug: '02-sights',       ss: 3.0, d: 6.5 },  // the forging — featured
  { slug: '06-motion-study', ss: 1.0, d: 4.0 },
  { slug: '03-tester-tech',  ss: 0.4, d: 4.2 },
  { slug: '04-trend-finder', ss: 0.0, d: 3.4 },
].filter(s => fs.existsSync(path.join(CLIPS, s.slug + '.webm')));

const args = [];
SEG.forEach(s => { args.push('-ss', String(s.ss), '-t', String(s.d), '-i', path.join(CLIPS, s.slug + '.webm')); });

const parts = [];
SEG.forEach((s, i) => {
  parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x141413,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`);
});
let last = 'v0', total = SEG[0].d;
for (let i = 1; i < SEG.length; i++) {
  const offset = (total - T).toFixed(2);
  const out = (i === SEG.length - 1) ? 'vout' : `x${i}`;
  parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${T}:offset=${offset}[${out}]`);
  last = out;
  total = total + SEG[i].d - T;
}

const reel = path.join(ASSETS, 'reel.mp4');
ff([...args, '-filter_complex', parts.join(';'), '-map', '[vout]',
    '-r', '30', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', reel]);
ff(['-y', '-i', reel, '-ss', '5', '-frames:v', '1', '-update', '1', '-q:v', '3',
    path.join(ASSETS, 'reel-poster.jpg')]);

console.log('reel.mp4', (fs.statSync(reel).size / 1024).toFixed(0) + 'KB', '~' + total.toFixed(1) + 's');
