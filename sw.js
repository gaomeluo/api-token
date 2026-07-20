/* Service Worker — API Token 大全
 * 作用：缓存应用外壳（HTML + 数据快照），使二次访问与弱网/离线也能秒开。
 * 数据以「实时 API 优先、localStorage 缓存、静态快照兜底」三重保障，
 * 这里只负责把静态资源缓存住，html 采用 network-first 以便更新能生效。
 * ⚠️ 更新数据快照(data.tokens.js / data.news.js)后，请修改 CACHE 版本号以触发刷新。
 */
const CACHE = "apitk-shell-v2";
const SHELL = ["./", "index.html", "data.tokens.js", "data.news.js", "data.tools.js", "logos.js", "sw.js"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch", function(e){
  const req = e.request;
  if(req.method!=="GET") return;
  const url = new URL(req.url);
  if(url.origin!==location.origin) return; // 跨域（worker API / 远程图）走网络，不缓存

  if(req.mode==="navigate"){
    // HTML：网络优先，失败回退缓存
    e.respondWith(fetch(req).then(function(res){
      const copy = res.clone();
      caches.open(CACHE).then(function(c){c.put("index.html", copy);});
      return res;
    }).catch(function(){return caches.match(req).then(function(r){return r||caches.match("index.html");});}));
    return;
  }
  // 静态资源：缓存优先，后台更新（stale-while-revalidate）
  e.respondWith(caches.match(req).then(function(cached){
    const net = fetch(req).then(function(res){
      if(res && res.status===200) caches.open(CACHE).then(function(c){c.put(req, res.clone());});
      return res;
    }).catch(function(){return cached;});
    return cached || net;
  }));
});
