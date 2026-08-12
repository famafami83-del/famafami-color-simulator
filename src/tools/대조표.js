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

 /* ── PDF(폰에서 보는 것) ────────────────────────────────────────────
    ★ 종이를 **폰 모양으로 좁게** 뽑는다 (대조표.js 의 pdf 크기 참조).
      A4 로 뽑았더니 대표가 폰에서 「검색해도 옆으로 밀어야 번호가 보인다」고 하셨다
      [대표, 2026-08-12]. A4 는 폭에 맞추면 글씨가 깨알이 되고, 글씨를 키우면
      번호가 화면 밖으로 나간다. 종이를 좁히면 **폭에 맞춘 채로 번호까지 다 들어온다.**

    ★ table{width:auto} 가 핵심이다. 기본값(width:100%)이면 칸들이 종이 폭 끝까지
      벌어져서 컬러명과 번호 사이가 텅 빈다 — 옆으로 밀어야 했던 진짜 까닭이다.
      auto 로 두면 칸이 글자 폭만큼만 잡혀 **번호가 이름 바로 옆에 붙는다.**

    영문명은 PDF 에서 뺀다. 주문서에는 한글명만 오므로 번호를 찾는 데 쓰이지 않는데,
    좁은 종이에서 자리를 제일 많이 먹는다. 영문명이 필요하면 HTML 쪽을 보면 된다.

    화면용 검색칸은 종이에서 쓸모가 없으니 빼고, 머리줄은 쪽마다 다시 찍는다
    (table-header-group) — 둘째 쪽부터 무슨 칸인지 모르게 된다. */
 @media print{
  body{background:#fff;padding:0}
  .q,.none,.en{display:none}
  .sub b{color:#2b2a27}
  /* 글씨 크기는 **종이 폭을 꽉 채우도록** 맞춘 값이다. 폰은 PDF 를 폭에 맞춰 보여주므로,
     표가 종이 폭의 60%만 쓰면 그 40%만큼 글씨가 작아져 보인다. 재어보고 키웠다 —
     지금 표가 종이 안쪽 폭의 90% 남짓을 쓴다. 글씨를 더 키우면 이름이 넘쳐 줄이 꺾인다. */
  h1{font-size:17px}
  .sub{font-size:11px;margin:0 0 9px;line-height:1.5}
  table{width:auto;font-size:16px}
  thead{display:table-header-group}
  th{padding:0 0 4px;font-size:11px}
  th:nth-child(3),th:nth-child(4){text-align:right}
  td{padding:5px 0;white-space:nowrap}
  /* 칸 사이는 여백으로만 벌린다. 번호가 이름에서 멀어지지 않게 좁게 준다. */
  td:nth-child(1){padding-right:8px}
  td:nth-child(2){padding-right:12px}
  td:nth-child(3){padding-right:11px}
  .su,.no{text-align:right}
  .su{font-size:14px}
  .sw{width:18px;height:18px;border-radius:4px}
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
    // ★ A4 가 아니라 **폰 모양의 좁고 긴 종이**로 뽑는다 [대표, 2026-08-12].
    //   폰에서 「폭 맞춤」으로 봤을 때 글씨가 읽히면서 번호까지 한 화면에 들어오는 크기다.
    //   A4(210mm)로 뽑으면 폭을 맞추는 순간 글씨가 깨알이 되고, 키우면 번호가 밖으로 나간다.
    //   여백도 종이가 좁은 만큼 바짝 줄인다 — 여백에 폭을 뺏기면 좁힌 뜻이 없어진다.
    await p.pdf({ path: pdf, width: '82mm', height: '168mm', printBackground: true,
      margin: { top: '6mm', bottom: '6mm', left: '6mm', right: '5mm' } });
    console.log('원단번호-대조표.pdf 생성 — 폰 화면에 맞춘 크기입니다');
  } catch (e) {
    console.log('  (PDF 는 건너뜁니다 — ' + e.message.split('\n')[0] + ')');
  } finally { if (b) await b.close(); }
  console.log('  두 파일 다 저장소에 안 올라갑니다. 폰으로 보내두고 쓰십시오.');
})();
