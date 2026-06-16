const puppeteer = require('puppeteer');
const BASE = 'https://rhealyn-ballar.vercel.app';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const pg = await b.newPage();
  const errors = [];
  pg.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
  pg.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  pg.on('requestfailed', r=>errors.push('REQFAIL: '+r.url()+' '+(r.failure()&&r.failure().errorText)));
  await pg.setViewport({width:1440,height:900,deviceScaleFactor:1});
  const resp = await pg.goto(BASE+'/about.html',{waitUntil:'networkidle2',timeout:60000});
  await sleep(4000);

  // 1 HTTP + errors
  console.log('1) HTTP status:', resp.status());

  // 2 profile photo
  const photo = await pg.$eval('.portrait img', img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,w:img.naturalWidth,h:img.naturalHeight}));
  console.log('2) profile photo:', JSON.stringify(photo));

  // 3 reel autoplay muted
  const reel = await pg.$eval('.reel video', v=>({muted:v.muted,autoplay:v.autoplay,loop:v.loop,paused:v.paused,curTime:v.currentTime,readyState:v.readyState}));
  console.log('3) reel video:', JSON.stringify(reel));

  // 4 + 5 cards: count + links + media type
  const cards = await pg.$$eval('.grid .tile', tiles=>tiles.map(t=>{
    const a=t.querySelector('a.thumb'); const v=t.querySelector('video'); const img=t.querySelector('img');
    return {title:(t.querySelector('h3')||{}).textContent, href:a?a.getAttribute('href'):null, media: v?'video':(img?'image':'none')};
  }));
  console.log('4/5) cards ('+cards.length+'):');
  cards.forEach(c=>console.log('   -',c.title,'=>',c.href,'['+c.media+']'));

  // 6 active nav
  const active = await pg.$eval('.nav-links a.active', a=>a.textContent.trim());
  console.log('6) active nav item:', active);

  // 7 scroll reveal
  const before = await pg.$$eval('.reveal', els=>els.filter(e=>e.classList.contains('in')).length);
  await pg.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await sleep(2500);
  const total = await pg.$$eval('.reveal', els=>els.length);
  const after = await pg.$$eval('.reveal', els=>els.filter(e=>e.classList.contains('in')).length);
  console.log('7) reveal .in: before='+before+' after-scroll='+after+'/'+total);

  console.log('CONSOLE ERRORS:', errors.length? errors : 'none');
  await b.close();

  // verify card link targets resolve (200)
  const https=require('https');
  const head=u=>new Promise(r=>{https.request(u,{method:'HEAD'},res=>r(res.statusCode)).on('error',()=>r('ERR')).end();});
  console.log('--- card target status ---');
  for(const c of cards){ if(c.href){ const code=await head(BASE+'/'+c.href); console.log('   '+code+'  '+c.href);} }
})().catch(e=>{console.error(e);process.exit(1)});
