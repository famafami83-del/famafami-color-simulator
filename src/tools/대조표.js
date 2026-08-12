/**
 * 원단 번호 대조표를 한 장짜리 페이지로 뽑는다 — **대표만 보는 것이다.**
 *   실행:  node src/tools/대조표.js
 *   결과:  원단번호-대조표.html   ← 저장소에 안 올라간다 (.gitignore)
 *
 * 왜 있는가. 2026-08-12 에 페이지·주문서·공개 데이터에서 원단 번호를 전부 뺐다.
 * 저장소가 공개라 번호를 넣어두면 경쟁사가 표를 통째로 가져가기 때문이다.
 * 그래서 카톡으로 오는 주문서에는 **「컬러명 + 몇수」**만 적힌다.
 * 발주할 때 번호가 필요하면 이 표에서 그 이름을 찾으면 된다.
 *
 * 만들어진 파일은 폰으로 보내두고 쓰시면 됩니다. 인터넷 없이도 열리고,
 * 위 칸에 이름을 몇 글자만 쳐도 걸러집니다.
 *
 * ★ 이 파일과 `src/원단번호.json` 은 **절대 커밋하지 마십시오.**
 *   지금은 .gitignore 가 막고 있습니다. 이름을 바꾸면 그 보호가 풀립니다.
 */
const fs = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '..');
const ROOT = path.join(SRC, '..');
const NOFILE = path.join(SRC, '원단번호.json');

if (!fs.existsSync(NOFILE))
  throw new Error(`번호표가 없습니다: ${NOFILE}\n`
    + '  이 파일은 저장소에 올라가지 않으므로, 새 컴퓨터에서 받으셨다면 없는 것이 맞습니다.\n'
    + '  대표 컴퓨터의 것을 복사해 오십시오.');

const SW  = JSON.parse(fs.readFileSync(path.join(SRC, 'swatches.json'), 'utf8'));
const NOS = JSON.parse(fs.readFileSync(NOFILE, 'utf8')).번호;

// 팔지 않는 색은 대조표에도 넣지 않는다 — build.js 의 EXCLUDE 와 같은 값이다.
// 여기 목록이 build.js 와 어긋나면 팔레트에 없는 색이 표에 섞이거나 그 반대가 된다.
const EXCLUDE = ['클라우드 화이트 60수', '클라우드 화이트 80수'];

const rows = [];
for (const g of Object.values(SW)) {
  for (const c of g.colors) {
    const id = `${c.ko} ${c.su}수`;
    if (EXCLUDE.includes(id)) continue;
    rows.push({ id, ko: c.ko, en: c.en, su: c.su, hex: c.hex, no: NOS[id], grp: g.ko });
  }
}

// 번호가 빠진 색이 있으면 멈춘다. 조용히 빈칸으로 두면 발주할 때 그 색에서 막힌다.
const miss = rows.filter(r => !r.no);
if (miss.length) throw new Error('원단번호.json 에 번호가 없는 색이 있습니다:\n'
  + miss.map(r => '  ' + r.id).join('\n'));

// 번호가 겹치면 둘 중 하나는 잘못 적힌 것이다.
const seen = {};
for (const r of rows) (seen[r.no] = seen[r.no] || []).push(r.id);
const dup = Object.entries(seen).filter(([, v]) => v.length > 1);
if (dup.length) throw new Error('번호가 겹칩니다:\n'
  + dup.map(([no, v]) => `  ${no}: ${v.join(' / ')}`).join('\n'));

rows.sort((a, b) => a.ko.localeCompare(b.ko, 'ko') || a.su - b.su);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>원단 번호 대조표 — 대외비</title>
<style>
 *{box-sizing:border-box}
 body{margin:0;padding:14px;background:#faf8f4;color:#2b2a27;
  font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif}
 h1{font-size:16px;margin:0 0 3px}
 .sub{font-size:12px;color:#8a857c;line-height:1.6;margin:0 0 12px}
 .sub b{color:#b03a2e}
 /* 폰에서 스크롤해도 검색칸은 늘 손 닿는 데 있어야 한다 */
 .q{position:sticky;top:0;z-index:2;padding:8px 0 10px;background:#faf8f4}
 .q input{width:100%;padding:12px 13px;font-size:16px;border:1px solid #ddd7cc;
  border-radius:9px;background:#fff;font-family:inherit}
 table{width:100%;border-collapse:collapse;font-size:13.5px}
 th{text-align:left;font-size:11px;color:#8a857c;font-weight:500;
  padding:0 6px 6px;border-bottom:1px solid #e6e0d5}
 td{padding:8px 6px;border-bottom:1px solid #efeae0;vertical-align:middle}
 tr.hide{display:none}
 .sw{width:26px;height:26px;border-radius:6px;border:1px solid rgba(0,0,0,.18);display:block}
 .no{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
 .su{color:#6b665e;white-space:nowrap}
 .en{font-size:11px;color:#a09a90}
 .none{display:none;padding:22px 6px;color:#8a857c;font-size:13px}
 .none.on{display:block}

 /* 종이(=PDF)로 뽑을 때. PDF 는 폰 기종을 안 가리고 열리고 뷰어에 검색이 딸려 있어서
    카톡으로 받아 보기에는 이쪽이 편하다. 화면용 검색칸은 종이에선 쓸모가 없으니 뺀다.
    머리줄은 쪽마다 다시 찍는다(table-header-group) — 둘째 쪽부터 무슨 칸인지 모르게 된다. */
 @media print{
  body{background:#fff;padding:0}
  .q,.none{display:none}
  .sub b{color:#2b2a27}
  table{font-size:10.5px}
  thead{display:table-header-group}
  th{padding:0 4px 3px}
  td{padding:3px 4px}
  .sw{width:15px;height:15px;border-radius:3px}
  /* 영문명을 한글명 **옆에** 붙인다. 화면에서는 아랫줄이지만 종이에서 아랫줄로 두면
     한 줄이 두 줄이 되어 쪽수가 갑절이 된다 (넉 장 → 두 장). */
  .en{display:inline;font-size:8.5px;margin-left:5px}
  tr{break-inside:avoid}
 }
</style></head><body>
<h1>원단 번호 대조표</h1>
<p class="sub">카톡 주문서에 적힌 <b>컬러명 + 몇수</b>를 찾으면 원단 번호가 나옵니다.
 모두 ${rows.length}색.<br>
 <b>이 표는 밖으로 내보내지 마십시오</b> — 홈페이지에서 번호를 뺀 뜻이 없어집니다.</p>
<div class="q"><input id="q" type="search" placeholder="컬러명·번호 찾기 (예: 캄 베이지)"
 autocomplete="off" autocapitalize="off"></div>
<table><thead><tr><th></th><th>컬러명</th><th>수</th><th>번호</th></tr></thead><tbody id="t">
${rows.map(r => `<tr data-s="${esc((r.ko + ' ' + r.en + ' ' + r.no + ' ' + r.su + '수 ' + r.grp).toLowerCase())}">`
  + `<td><span class="sw" style="background:${r.hex}"></span></td>`
  + `<td>${esc(r.ko)}<div class="en">${esc(r.en)}</div></td>`
  + `<td class="su">${r.su}수</td><td class="no">${esc(r.no)}</td></tr>`).join('\n')}
</tbody></table>
<p class="none" id="none">찾으시는 색이 없습니다.</p>
<script>
var rows = [].slice.call(document.querySelectorAll('#t tr'));
document.getElementById('q').addEventListener('input', function (e) {
  var q = e.target.value.trim().toLowerCase(), n = 0;
  rows.forEach(function (r) {
    var ok = !q || r.dataset.s.indexOf(q) >= 0;
    r.classList.toggle('hide', !ok); if (ok) n++;
  });
  document.getElementById('none').classList.toggle('on', n === 0);
});
</script>
</body></html>`;

const out = path.join(ROOT, '원단번호-대조표.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`원단번호-대조표.html 생성 — ${rows.length}색`);

// PDF 도 함께 뽑는다. **폰에서는 이쪽이 편하다** — 카톡으로 받아 바로 열리고
// (HTML 은 기종에 따라 「연결 프로그램」을 고르게 하거나 글자만 보여준다),
// PDF 뷰어에 검색이 딸려 있어 이름으로 찾는 것도 그대로 된다.
//   puppeteer 가 없거나 크롬을 못 찾으면 조용히 넘어간다 — HTML 만으로도 쓸 수 있다.
(async () => {
  let puppeteer;
  try { puppeteer = require(path.join(ROOT, 'node_modules', 'puppeteer-core')); }
  catch (_) {
    console.log('  (PDF 는 건너뜁니다 — puppeteer-core 가 없습니다. HTML 만으로도 씁니다.)');
    return;
  }
  let b;
  try {
    b = await puppeteer.launch({ channel: 'chrome', headless: 'new', args: ['--no-sandbox'] });
    const p = await b.newPage();
    await p.goto('file:///' + out.replace(/\\/g, '/'), { waitUntil: 'load' });
    const pdf = path.join(ROOT, '원단번호-대조표.pdf');
    await p.pdf({ path: pdf, format: 'A4', printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
    console.log('원단번호-대조표.pdf 생성 — 폰에서는 이쪽이 편합니다');
  } catch (e) {
    console.log('  (PDF 는 건너뜁니다 — ' + e.message.split('\n')[0] + ')');
  } finally { if (b) await b.close(); }
  console.log('  두 파일 다 저장소에 안 올라갑니다. 폰으로 보내두고 쓰십시오.');
})();
