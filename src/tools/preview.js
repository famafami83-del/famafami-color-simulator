// 올리기 전에 폰으로 미리 보는 서버.
//
//   node src/tools/preview.js
//
// 같은 와이파이에 있는 폰에서 화면에 뜬 주소를 치면 지금 만든 index.html 이 그대로 보인다.
// 깃허브에 올릴 필요가 없다 — 고쳤으면 `node src/build.js` 만 다시 하고 폰에서 새로고침.
//
// 컴퓨터에서만 볼 거면 이것도 필요 없다. `index.html` 을 두 번 누르면 열린다.
// (사진도 마스크도 페이지 안에 들어 있어 file:// 에서도 색이 먹는다. 뒤로가기만 안 된다.)

const http = require('http');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.argv[2]) || 8080;

const TYPE = { '.html':'text/html; charset=utf-8', '.json':'application/json; charset=utf-8',
               '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2' };

http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, rel === '/' ? 'index.html' : rel.slice(1));
  // 저장소 밖으로 못 나가게 막는다. 미리보기라도 폰에 열어두는 서버다.
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end('없는 파일: ' + rel); }
    // 폰이 옛 화면을 붙들고 있지 않게 캐시를 끈다 — 미리보기의 요점이 그것이다.
    r.writeHead(200, { 'Content-Type': TYPE[path.extname(f)] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });
    r.end(d);
  });
}).listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  const kb = Math.round(fs.statSync(path.join(ROOT, 'index.html')).size / 1024);
  console.log(`미리보기 서버 — index.html ${kb}KB\n`);
  console.log(`  이 컴퓨터 : http://localhost:${PORT}/`);
  for (const ip of ips) console.log(`  폰·태블릿 : http://${ip}:${PORT}/   ← 같은 와이파이`);
  console.log(`\n고치면 node src/build.js 다시 하고 폰에서 새로고침하면 됩니다.`);
  console.log(`끄려면 Ctrl+C.`);
});
