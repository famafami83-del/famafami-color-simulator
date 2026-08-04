/**
 * 컬러 시뮬레이터 페이지를 만든다.
 *   실행:  node src/build.js       (어느 폴더에서 실행해도 된다)
 *   결과:  index.html  ← 저장소 루트에 덮어쓴다. 이 파일이 그대로 배포된다.
 *
 * 이미지는 전부 base64로 안에 넣는다. CSS 마스크는 file:// 에서 외부 파일을
 * 못 읽으므로, 분리해두면 로컬에서 색이 안 먹힌다.
 */
const fs = require('fs');
const path = require('path');

const SRC    = __dirname;
const ROOT   = path.join(SRC, '..');
const ASSETS = path.join(SRC, 'assets');

const SW = JSON.parse(fs.readFileSync(path.join(SRC, 'swatches.json'), 'utf8'));
const b64 = (f, m) => `data:${m};base64,` + fs.readFileSync(path.join(ASSETS, f)).toString('base64');

// 베개 위치: 앞줄 왼쪽=pillowF, 앞줄 오른쪽=pillowR, 뒷줄 왼쪽=pillowL, 뒷줄 오른쪽=pillowW
const PARTS = [
  { key:'quilt',    ko:'이불',            def:'#cee2d6', su:null },
  { key:'mattress', ko:'매트리스커버',     def:'#b9a898', su:[60,80] },
  { key:'pillowF',  ko:'베개(앞)-왼쪽',    def:'#b9a898', su:null },
  { key:'pillowR',  ko:'베개(앞)-오른쪽',  def:'#cee2d6', su:null },
  { key:'pillowL',  ko:'베개(뒤)-왼쪽',    def:'#cee2d6', su:null },
  { key:'pillowW',  ko:'베개(뒤)-오른쪽',  def:'#f1ebdb', su:null },
];

// 이불 = 완제품 크기 / 매트리스커버 = 침대 규격. 체계가 다르다 [대표, 2026-08-04]
// 견적을 내려면 모든 선택지가 가격을 가져야 하므로 "잘 모르겠습니다" 류는 두지 않는다 [대표]
const QUILT = ['슈퍼싱글 150×210','퀸 200×230','킹 220×240','라지킹 240×240'];
const MAT = ['싱글 100×200','슈퍼싱글 110×200','퀸 150×200','160×200','170×200',
  '180×200','190×200','200×200'];
const OZ = ['여름용 (4온스)','초여름·간절기용 (6온스)','간절기용 (8온스)','한겨울용 (10온스)'];
const PILLOW = ['40×60','50×70','그 외 — 아래에 적어주세요'];
const QTY = ['1장','2장','3장','4장','5장 이상'];

const total = Object.values(SW).reduce((s,g)=>s+g.colors.length,0);

const html = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>파마파미 컬러 시뮬레이터</title>
<style>
 :root{--bg:#faf9f7;--fg:#2b2724;--mut:#8a827b;--line:#e6e1da;--card:#fff;--soft:#f2efea}
 @media (prefers-color-scheme:dark){:root{--bg:#17150f;--fg:#ece7df;--mut:#9c948a;--line:#2f2a24;--card:#201d17;--soft:#262219}}
 :root[data-theme="dark"]{--bg:#17150f;--fg:#ece7df;--mut:#9c948a;--line:#2f2a24;--card:#201d17;--soft:#262219}
 :root[data-theme="light"]{--bg:#faf9f7;--fg:#2b2724;--mut:#8a827b;--line:#e6e1da;--card:#fff;--soft:#f2efea}
 *{box-sizing:border-box}
 html,body{margin:0;padding:0}
 body{background:var(--bg);color:var(--fg);line-height:1.6;padding-bottom:76px;
  font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
 .wrap{max-width:960px;margin:0 auto;padding:16px 14px 24px}

 header{margin-bottom:12px}
 h1{font-size:17px;font-weight:650;margin:0 0 2px;letter-spacing:-.01em}
 .sub{font-size:12.5px;color:var(--mut);margin:0}

 /* 진행 표시 */
 .steps{display:flex;gap:6px;margin:14px 0 16px}
 .steps div{flex:1;font-size:11.5px;text-align:center;padding:7px 2px;border-radius:7px;
  background:var(--soft);color:var(--mut);border:1px solid transparent}
 .steps div[aria-current="true"]{background:var(--fg);color:var(--bg);font-weight:600}

 /* 미리보기 */
 .scene{position:relative;border-radius:11px;overflow:hidden;background:#fff;isolation:isolate;
  box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 20px rgba(0,0,0,.07);margin-bottom:14px}
 .scene img{display:block;width:100%;height:auto}
 .layer{position:absolute;inset:0;mix-blend-mode:multiply;pointer-events:none;
  -webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-mode:alpha;mask-mode:alpha;transition:background-color .18s}
 .scene.mini{max-width:190px;margin:0 auto 16px}

 .step{display:none}
 .step[aria-hidden="false"]{display:block}

 /* 부위 · 팔레트 */
 .parts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
 .part{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--fg);
  border-radius:999px;padding:7px 13px 7px 8px;font-size:13px;cursor:pointer;font-family:inherit}
 .part[aria-pressed="true"]{border-color:var(--fg);background:var(--fg);color:var(--bg);font-weight:600}
 .dot{width:17px;height:17px;border-radius:50%;border:1px solid rgba(0,0,0,.18);flex:none}
 .now{display:flex;align-items:center;gap:11px;padding:11px 12px;border:1px solid var(--line);
  border-radius:9px;margin-bottom:6px;background:var(--card)}
 .now .big{width:34px;height:34px;border-radius:7px;border:1px solid rgba(0,0,0,.14);flex:none}
 .now .l1{font-size:13.5px;font-weight:600}
 .now .l2{font-size:11.5px;color:var(--mut)}
 .hint{font-size:11.5px;color:var(--mut);margin:0 0 12px}
 .gname{font-size:11px;color:var(--mut);margin:14px 0 7px}
 .sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:7px}
 .sw button{aspect-ratio:1;border-radius:8px;border:1px solid rgba(0,0,0,.12);cursor:pointer;padding:0}
 .sw button[aria-current="true"]{box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--fg)}

 /* 입력 */
 .card{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px}
 .card h2{font-size:13.5px;font-weight:650;margin:0 0 3px}
 .card p.d{font-size:11.5px;color:var(--mut);margin:0 0 11px}
 .fld{margin-bottom:9px}
 .fld:last-child{margin-bottom:0}
 .fld label{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}
 .fld select,.fld input{width:100%;padding:11px 12px;border-radius:8px;border:1px solid var(--line);
  background:var(--bg);color:var(--fg);font-size:14px;font-family:inherit}
 .fld select:focus,.fld input:focus{outline:2px solid var(--fg);outline-offset:-1px}
 .two{display:grid;grid-template-columns:1fr 1fr;gap:9px}
 .skip{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut);margin-top:10px;cursor:pointer}
 .skip input{width:17px;height:17px;accent-color:var(--fg)}
 .off{opacity:.4;pointer-events:none}

 /* 확인 */
 pre{margin:0 0 10px;padding:13px;background:var(--card);border:1px solid var(--line);border-radius:9px;
  font-size:12.5px;line-height:1.85;white-space:pre-wrap;word-break:break-word;
  font-family:ui-monospace,SFMono-Regular,Menlo,"D2Coding",monospace}
 .ordnote{font-size:11.5px;color:var(--mut);margin:0;line-height:1.7}

 /* 하단 고정 이동 */
 .nav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--bg);
  border-top:1px solid var(--line);padding:11px 14px calc(11px + env(safe-area-inset-bottom));
  display:flex;gap:9px;max-width:960px;margin:0 auto}
 .nav button{flex:1;padding:14px;border-radius:9px;font-size:14px;font-weight:600;
  cursor:pointer;font-family:inherit;border:1px solid var(--fg)}
 .nav .prev{background:transparent;color:var(--fg);flex:0 0 92px}
 .nav .next{background:var(--fg);color:var(--bg)}
 .nav button[hidden]{display:none}
</style>
</head><body>

<div class="wrap">
<header>
  <h1>파마파미 컬러 시뮬레이터</h1>
  <p class="sub">원단 ${total}색 중에서 고르실 수 있습니다.</p>
</header>

<div class="steps">
  <div data-s="0" aria-current="true">① 색 고르기</div>
  <div data-s="1">② 사이즈</div>
  <div data-s="2">③ 확인</div>
</div>

<!-- ① 색 -->
<section class="step" data-step="0" aria-hidden="false">
  <div class="scene" id="sceneMain">
    <img src="${b64('base.jpg','image/jpeg')}" alt="침구 미리보기">
${PARTS.map(p=>{const u=b64(`mask_${p.key}.png`,'image/png');return `    <div class="layer" data-part="${p.key}" style="background-color:${p.def};-webkit-mask-image:url('${u}');mask-image:url('${u}')"></div>`;}).join('\n')}
  </div>
  <div class="parts">
${PARTS.map((p,i)=>`    <button class="part" data-part="${p.key}" aria-pressed="${i===0}"><span class="dot" style="background:${p.def}"></span>${p.ko}</button>`).join('\n')}
  </div>
  <div class="now">
    <span class="big" id="nowSw"></span>
    <span><span class="l1" id="nowL1">-</span><br><span class="l2" id="nowL2">-</span></span>
  </div>
  <p class="hint" id="palHint"></p>
  <div id="palette"></div>
</section>

<!-- ② 사이즈 -->
<section class="step" data-step="1" aria-hidden="true">
  <div class="card">
    <h2>이불</h2>
    <p class="d">차렵이불(솜일체형)입니다.</p>
    <div id="grpQuilt">
      <div class="fld"><label>사이즈</label><select id="q_size">${QUILT.map(o=>`<option${o==='퀸 200×230'?' selected':''}>${o}</option>`).join('')}</select></div>
      <div class="fld"><label>두께</label><select id="q_oz">${OZ.map(o=>`<option${o==='간절기용 (8온스)'?' selected':''}>${o}</option>`).join('')}</select></div>
    </div>
    <label class="skip"><input type="checkbox" id="q_skip"> 이불은 안 할래요</label>
  </div>

  <div class="card">
    <h2>매트리스커버</h2>
    <p class="d">매트리스 실제 사이즈가 필요합니다. <b>재실 필요 없습니다</b> — 사신 곳에 나와 있는 숫자를 적어주세요.</p>
    <div id="grpMat">
      <div class="fld"><label>침대 규격</label><select id="m_size">${MAT.map(o=>`<option${o==='퀸 150×200'?' selected':''}>${o}</option>`).join('')}</select></div>
      <div class="two">
        <div class="fld"><label>가로 × 세로 (cm)</label><input id="m_wh" type="text" inputmode="numeric" placeholder="예: 150x200"></div>
        <div class="fld"><label>높이 (cm)</label><input id="m_h" type="text" inputmode="numeric" placeholder="예: 25"></div>
      </div>
    </div>
    <label class="skip"><input type="checkbox" id="m_skip"> 매트리스커버는 안 할래요</label>
  </div>

  <div class="card">
    <h2>베개커버</h2>
    <p class="d">쓰시는 베개 사이즈입니다. 베개 사신 곳에 나와 있는 숫자면 됩니다.</p>
    <div id="grpPil">
      <div class="two">
        <div class="fld"><label>사이즈</label><select id="p_size">${PILLOW.map(o=>`<option${o==='50×70'?' selected':''}>${o}</option>`).join('')}</select></div>
        <div class="fld"><label>수량</label><select id="p_qty">${QTY.map(o=>`<option${o==='2장'?' selected':''}>${o}</option>`).join('')}</select></div>
      </div>
    </div>
    <label class="skip"><input type="checkbox" id="p_skip"> 베개커버는 안 할래요</label>
  </div>

  <div class="card">
    <h2>남기실 말</h2>
    <p class="d">쓰시는 침구, 궁금한 점, 원하시는 조합 등 자유롭게 적어주세요.</p>
    <div class="fld"><input id="memo" type="text" placeholder="예) 시몬스 침대에 60x90 베개를 씁니다"></div>
  </div>
</section>

<!-- ③ 확인 -->
<section class="step" data-step="2" aria-hidden="true">
  <div class="scene mini" id="sceneMini"></div>
  <pre id="orderTxt"></pre>
  <button class="nav-copy" id="copyBtn" style="display:none"></button>
  <p class="ordnote">
    <b>기성 상품에 없는 조합은 맞춤 제작입니다.</b> 금액이 조금 달라지니
    위 내용을 복사해서 문의 주시면 정확한 금액을 안내드립니다.<br><br>
    화면 색과 실물은 조금 다를 수 있습니다. <b>번호와 이름은 원단 컬러차트 그대로</b>라
    그대로 알려주시면 됩니다.
  </p>
</section>
</div>

<div class="nav">
  <button class="prev" id="btnPrev" hidden>이전</button>
  <button class="next" id="btnNext">사이즈 입력하기</button>
</div>

<script>
const SW = ${JSON.stringify(SW)};
const PARTS = ${JSON.stringify(PARTS)};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const byHex = {};
for (const g of Object.values(SW)) for (const c of g.colors) if(!byHex[c.hex]) byHex[c.hex] = c;
const state = {};
PARTS.forEach(p => state[p.key] = byHex[p.def] || { no:'', en:'', ko:'직접 지정', su:'', hex:p.def });
let cur = PARTS[0], step = 0;

/* ---- 단계 이동 ---- */
const NEXT_LABEL = ['사이즈 입력하기','확인하기','복사하기'];
function goto(s){
  step = s;
  $$('.step').forEach(el => el.setAttribute('aria-hidden', +el.dataset.step !== s));
  $$('.steps div').forEach(el => el.setAttribute('aria-current', +el.dataset.s === s));
  $('#btnPrev').hidden = s === 0;
  $('#btnNext').textContent = NEXT_LABEL[s];
  if (s === 2) { buildMini(); renderOrder(); }
  window.scrollTo({ top:0, behavior:'instant' });
}
$('#btnPrev').onclick = () => goto(Math.max(0, step-1));
$('#btnNext').onclick = async () => {
  if (step < 2) return goto(step+1);
  const t = $('#orderTxt').textContent;
  try { await navigator.clipboard.writeText(t); }
  catch(_) { const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  const b = $('#btnNext'); b.textContent='복사했습니다'; setTimeout(()=>b.textContent='복사하기',1500);
};

/* ---- 색 ---- */
const layers = {}, dots = {};
$$('.layer').forEach(l => layers[l.dataset.part] = l);
$$('.part').forEach(b => {
  dots[b.dataset.part] = b.querySelector('.dot');
  b.onclick = () => { cur = PARTS.find(p => p.key === b.dataset.part);
    $$('.part').forEach(x => x.setAttribute('aria-pressed', x === b)); renderColor(); };
});
function label(c){ return c.no ? \`NO. \${c.no} · \${c.ko} \${c.su}수\` : c.ko; }
function apply(c){
  state[cur.key] = c;
  layers[cur.key].style.backgroundColor = c.hex;
  dots[cur.key].style.background = c.hex;
  renderColor();
}
function renderColor(){
  const c = state[cur.key];
  $('#nowSw').style.background = c.hex;
  $('#nowL1').textContent = c.ko + (c.su ? ' ' + c.su + '수' : '');
  $('#nowL2').textContent = (c.no ? 'NO. ' + c.no + '  ·  ' : '') + c.en;
  const allow = cur.su; let shown = 0;
  $$('.sw button').forEach(b => {
    const ok = !allow || allow.includes(+b.dataset.su);
    b.style.display = ok ? '' : 'none'; if (ok) shown++;
    b.setAttribute('aria-current', ok && b.dataset.hex === c.hex);
  });
  $$('.gname').forEach(g => {
    const any = [...g.nextElementSibling.children].some(b => b.style.display !== 'none');
    g.style.display = any ? '' : 'none'; g.nextElementSibling.style.display = any ? '' : 'none';
  });
  $('#palHint').textContent = allow
    ? \`매트리스커버는 \${allow.join('·')}수만 됩니다 (100수는 얇아서 쓰지 않습니다) — \${shown}색\`
    : \`\${shown}색\`;
}
const pal = $('#palette');
for (const g of Object.values(SW)) {
  const t = document.createElement('div'); t.className='gname'; t.textContent = g.ko + '  ' + g.en; pal.appendChild(t);
  const row = document.createElement('div'); row.className='sw';
  g.colors.forEach(c => {
    const b = document.createElement('button');
    b.style.background = c.hex; b.dataset.hex = c.hex; b.dataset.su = c.su;
    b.title = 'NO. ' + c.no + ' ' + c.ko + ' ' + c.su + '수';
    b.onclick = () => apply(c); row.appendChild(b);
  });
  pal.appendChild(row);
}

/* ---- 사이즈: 안 할래요 체크 시 비활성 ---- */
[['q_skip','grpQuilt'],['m_skip','grpMat'],['p_skip','grpPil']].forEach(([c,g]) => {
  $('#'+c).onchange = e => $('#'+g).classList.toggle('off', e.target.checked);
});

/* ---- 확인 화면 ---- */
function buildMini(){
  const mini = $('#sceneMini');
  if (mini.dataset.built) { PARTS.forEach(p => mini.querySelector('[data-part="'+p.key+'"]').style.backgroundColor = state[p.key].hex); return; }
  mini.innerHTML = $('#sceneMain').innerHTML;
  mini.dataset.built = '1';
  PARTS.forEach(p => mini.querySelector('[data-part="'+p.key+'"]').style.backgroundColor = state[p.key].hex);
}
function renderOrder(){
  const L = [];
  if (!$('#q_skip').checked) L.push('■ 이불', '   사이즈 : ' + $('#q_size').value, '   두께 : ' + $('#q_oz').value, '   컬러 : ' + label(state.quilt), '');
  if (!$('#m_skip').checked) {
    const wh = $('#m_wh').value.trim(), h = $('#m_h').value.trim();
    L.push('■ 매트리스커버', '   규격 : ' + $('#m_size').value);
    if (wh || h) L.push('   실제 사이즈 : ' + (wh||'-') + (h ? ' / 높이 ' + h : ''));
    L.push('   컬러 : ' + label(state.mattress), '');
  }
  if (!$('#p_skip').checked) {
    L.push('■ 베개커버', '   사이즈 : ' + $('#p_size').value, '   수량 : ' + $('#p_qty').value,
      ...PARTS.filter(p=>p.key.startsWith('pillow')).map(p => '   ' + p.ko + ' : ' + label(state[p.key])), '');
  }
  const memo = $('#memo').value.trim();
  if (memo) L.push('■ 남기실 말', '   ' + memo, '');
  if (!L.length) L.push('선택하신 항목이 없습니다.');
  $('#orderTxt').textContent = L.join('\\n').trim();
}

renderColor();
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
// 컬러 데이터도 저장소 루트에 공개용으로 함께 내보낸다
fs.writeFileSync(path.join(ROOT, 'colors.json'), JSON.stringify(SW, null, 1), 'utf8');

const kb = Math.round(fs.statSync(path.join(ROOT,'index.html')).size / 1024);
console.log(`index.html 생성 — 원단 ${total}색 / 부위 ${PARTS.length}곳 / 3단계 / ${kb}KB`);
