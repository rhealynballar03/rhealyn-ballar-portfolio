const puppeteer = require('puppeteer');
const BASE='https://rhealyn-ballar.vercel.app';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  const pg=await b.newPage();
  const notfound=[];
  pg.on('response',res=>{ if(res.status()===404) notfound.push(res.url()); });
  await pg.setViewport({width:1440,height:900});
  await pg.goto(BASE+'/about.html',{waitUntil:'networkidle2'});
  await sleep(2000);
  // gradual scroll
  const h=await pg.evaluate(()=>document.body.scrollHeight);
  for(let y=0;y<=h;y+=300){ await pg.evaluate(yy=>window.scrollTo(0,yy),y); await sleep(120); }
  await sleep(1500);
  const r=await pg.$$eval('.reveal',els=>({total:els.length,in:els.filter(e=>e.classList.contains('in')).length,
     notIn:els.filter(e=>!e.classList.contains('in')).map(e=>e.id||e.className)}));
  console.log('reveal after gradual scroll:', JSON.stringify(r));
  console.log('404 URLs:', notfound.length?notfound:'none');
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
