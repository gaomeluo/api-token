const fs = require('fs');
global.window = {};
require('./data.tokens.js');
require('./data.tools.js');
const ALL = global.window.__TOKENS__, TOOLS = global.window.__TOOLS__;

function host(u){ try { return new URL(u).hostname.replace(/^www\./,''); } catch(e){ return ''; } }
function rootDomain(h){
  const p = h.split('.');
  if (p.length > 2){
    const two = p.slice(-2).join('.');
    const tld2 = ['com.cn','edu.cn','org.cn','gov.cn','co.uk','com.au'];
    if (tld2.includes(two)) return p.slice(-3).join('.');
    return two;
  }
  return h;
}

const hosts = new Set();
ALL.forEach(t=>{ const h=host(t.url); if(h){hosts.add(h); hosts.add(rootDomain(h));} });
TOOLS.forEach(t=>{ const h=host(t.u); if(h){hosts.add(h); hosts.add(rootDomain(h));} });

const list = [...hosts];
console.log('total candidate hosts:', list.length);

async function fetchOne(h){
  const urls = [
    `https://icons.duckduckgo.com/ip3/${h}.ico`,
    `https://www.google.com/s2/favicons?domain=${h}&sz=64`,
    `https://favicon.im/${h}`,
    `https://www.google.com/s2/favicons?domain=${h}&sz=128`
  ];
  for (const u of urls){
    try{
      const r = await fetch(u, { redirect:'follow', headers:{ 'User-Agent':'Mozilla/5.0' } });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 200) continue;
      if (buf.length > 80000) continue;
      return buf;
    }catch(e){ /* try next */ }
  }
  return null;
}

function b64(buf){ return 'data:image/x-icon;base64,' + buf.toString('base64'); }

(async () => {
  const map = {};
  const CONC = 12;
  let done = 0, ok = 0, fail = 0;
  for (let i=0; i<list.length; i+=CONC){
    const batch = list.slice(i, i+CONC);
    const res = await Promise.all(batch.map(h => fetchOne(h).then(b => [h,b])));
    for (const [h,b] of res){
      done++;
      if (b){ map[h] = b64(b); ok++; }
      else { fail++; }
    }
    process.stdout.write(`\r fetched ${done}/${list.length}  ok=${ok} fail=${fail}`);
  }
  console.log('\nwriting logos.js ...');
  const out = 'window.__LOGOS__=' + JSON.stringify(map) + ';\n';
  fs.writeFileSync('logos.js', out);
  console.log('logos.js bytes:', fs.statSync('logos.js').size, ' entries:', Object.keys(map).length);
  const failed = list.filter(h => !map[h]);
  console.log('FAILED (' + failed.length + '):', failed.join(', '));
})();
