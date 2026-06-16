// Build an autoplay slideshow reel from the project screenshots using FFmpeg.
// Each shot is scaled+padded to 1920x1080 and crossfaded into the next.
// Run from .tooling:  node generate-reel.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, '..', 'assets', 'shots');
const OUT = path.join(__dirname, '..', 'assets', 'reel.mp4');
const POSTER = path.join(__dirname, '..', 'assets', 'reel-poster.jpg');

// order shown in the reel (only pages with real visual content)
const ORDER = [
  '01-smart-watch.png',
  '03-tester-tech.png',
  '02-sights.png',
  '06-motion-study.png',
  '04-trend-finder.png',
  '07-moodboard.png',
];
const imgs = ORDER.map(f => path.join(SHOTS, f)).filter(fs.existsSync);

const D = 3.0;   // seconds each shot is held
const T = 0.8;   // crossfade duration
const W = 1920, H = 1080;

// inputs: each image looped for D seconds
const args = [];
imgs.forEach(img => { args.push('-loop', '1', '-t', String(D), '-i', img); });

// normalize each input to WxH, 30fps, sar=1
const parts = [];
imgs.forEach((_, i) => {
  parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x141413,setsar=1,fps=30,format=yuv420p[v${i}]`);
});

// chain crossfades
let last = 'v0';
for (let i = 1; i < imgs.length; i++) {
  const offset = (i * (D - T)).toFixed(2);
  const out = (i === imgs.length - 1) ? 'vout' : `x${i}`;
  parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${T}:offset=${offset}[${out}]`);
  last = out;
}
if (imgs.length === 1) parts.push('[v0]copy[vout]');

const filter = parts.join(';');

const full = [
  ...args,
  '-filter_complex', filter,
  '-map', '[vout]',
  '-r', '30',
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-y', OUT,
];

console.log(`Building reel from ${imgs.length} shots -> ${OUT}`);
const r = spawnSync('ffmpeg', full, { stdio: ['ignore', 'ignore', 'inherit'] });
if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }

// poster frame (1s in)
spawnSync('ffmpeg', ['-y', '-i', OUT, '-ss', '1', '-frames:v', '1', '-q:v', '3', POSTER],
  { stdio: ['ignore', 'ignore', 'inherit'] });

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`Done. reel.mp4 = ${kb} KB`);
