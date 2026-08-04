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
// qty = 베개커버 기본 장수. 앞줄 둘만 1장으로 두면 흔한 경우(2장)가 기본이 된다.
const PARTS = [
  { key:'quilt',    ko:'이불',            def:'#cee2d6', su:null },
  { key:'mattress', ko:'매트리스커버',     def:'#b9a898', su:[60,80] },
  { key:'pillowF',  ko:'베개(앞)-왼쪽',    def:'#b9a898', su:null, qty:1 },
  { key:'pillowR',  ko:'베개(앞)-오른쪽',  def:'#cee2d6', su:null, qty:1 },
  { key:'pillowL',  ko:'베개(뒤)-왼쪽',    def:'#cee2d6', su:null, qty:0 },
  { key:'pillowW',  ko:'베개(뒤)-오른쪽',  def:'#f1ebdb', su:null, qty:0 },
];
const PILLOWS = PARTS.filter(p => p.qty !== undefined);

// 이불 = 완제품 크기 / 매트리스커버 = 침대 규격. 체계가 다르다 [대표, 2026-08-04]
// 견적을 내려면 모든 선택지가 가격을 가져야 하므로 "잘 모르겠습니다" 류는 두지 않는다 [대표]
const QUILT = ['슈퍼싱글 150×210','퀸 200×230','킹 220×240','라지킹 240×240'];
const MAT = ['싱글 100×200','슈퍼싱글 110×200','퀸 150×200','160×200','170×200',
  '180×200','190×200','200×200'];
const OZ = ['여름용 (4온스)','초여름·간절기용 (6온스)','간절기용 (8온스)','한겨울용 (10온스)'];
// 사이즈·수량 모두 4칸에서 각각 받는다. 40×60과 50×70을 섞어 쓰는 집이 있고,
// 수량을 따로 받으면 "4색을 골랐는데 2장" 처럼 어느 색인지 알 수 없어진다 [대표, 2026-08-04]
const PIL_ASK = '그 외';                       // 사이즈가 정해지지 않아 값을 못 내는 선택지
const PILLOW = ['40×60','50×70',PIL_ASK];
const PIL_QTY = [0,1,2,3,4];

/* ────────────────────────────────────────────────────────────────
   가격 — 여기 숫자만 채우면 견적이 붙는다. 단위: 원.

   견적 = 사이즈별 판매가 + 맞춤 추가금(항목당 정액)   [대표, 2026-08-04]
   · 이불   가격은 사이즈로만 정해진다. 두께(온스)는 가격과 무관.
   · 베개커버 판매가·추가금은 모두 "1장당" 금액이다. (수량만큼 곱한다)
   · 매트리스커버는 기준 높이를 넘으면 추가금이 한 번 더 붙는다.

   null 인 칸은 "문의"로 표시되고 합계에서 빠진다.
   전부 null 이면 견적 화면이 아예 나오지 않는다 — 그래서 지금 배포해도 안전하다.
──────────────────────────────────────────────────────────────── */
const PRICE = {
  quilt: {
    sale: {
      '슈퍼싱글 150×210': null,
      '퀸 200×230':      null,
      '킹 220×240':      null,
      '라지킹 240×240':  null,
    },
    custom: null,          // 이불 맞춤 추가금 (1장당)
  },
  mattress: {
    sale: {
      '싱글 100×200':     null,
      '슈퍼싱글 110×200': null,
      '퀸 150×200':       null,
      '160×200':          null,
      '170×200':          null,
      '180×200':          null,
      '190×200':          null,
      '200×200':          null,
    },
    custom:     null,      // 매트리스커버 맞춤 추가금 (1장당)
    heightBase: null,      // 이 높이(cm)까지는 추가금 없음. 예: 30
    heightAdd:  null,      // 기준을 넘으면 더하는 금액
  },
  pillow: {
    sale: {                // '그 외'는 사이즈가 정해지지 않으니 가격도 못 낸다 → 문의
      '40×60': null,
      '50×70': null,
    },
    custom: null,          // 베개커버 맞춤 추가금 (1장당)
  },
};

// 이 페이지로 들어오는 주문은 색 조합을 직접 고른 것이라 전부 맞춤 제작이다.
// 그래서 맞춤 추가금은 항상 붙는다. 기성가로만 낼 일이 생기면 false 로 바꾼다.
const ALWAYS_CUSTOM = true;

// 사이즈 목록과 가격표가 어긋나면 조용히 "문의"로 새어나가므로 여기서 잡는다.
// 베개커버의 '그 외'는 값을 못 내는 게 정상이라 가격표에서 뺀다.
for (const [group, list] of [['quilt', QUILT], ['mattress', MAT],
                             ['pillow', PILLOW.filter(s => s !== PIL_ASK)]]) {
  const table = PRICE[group].sale;
  const miss = list.filter(s => !(s in table));
  const extra = Object.keys(table).filter(s => !list.includes(s));
  if (miss.length || extra.length)
    throw new Error(`PRICE.${group}.sale 이 사이즈 목록과 다릅니다`
      + (miss.length  ? `\n  가격표에 없는 사이즈: ${miss.join(', ')}` : '')
      + (extra.length ? `\n  목록에 없는 가격 항목: ${extra.join(', ')}` : ''));
}

const hasPrice = o => Object.values(o).some(v => v && typeof v === 'object' ? hasPrice(v) : v != null);
const PRICE_READY = hasPrice(PRICE);

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

 /* 베개 4칸 — 칸마다 색·사이즈·장수 */
 .prow{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-top:1px solid var(--line)}
 .prow:first-child{border-top:0;padding-top:2px}
 .prow .pdot{width:26px;height:26px;border-radius:6px;border:1px solid rgba(0,0,0,.16);flex:none;margin-top:1px}
 .prow .pmain{flex:1;min-width:0}
 .prow .pnm{font-size:13px;font-weight:600;line-height:1.35}
 .prow .pcl{font-size:11px;color:var(--mut);margin-bottom:7px;line-height:1.4}
 .psel{display:flex;gap:7px}
 .psel select{padding:9px 8px;border-radius:8px;border:1px solid var(--line);
  background:var(--bg);color:var(--fg);font-size:13.5px;font-family:inherit;min-width:0}
 .psel select:focus{outline:2px solid var(--fg);outline-offset:-1px}
 .psel .ps{flex:1}
 .psel .pq{flex:0 0 76px}
 .prow.zero .pdot,.prow.zero .pnm,.prow.zero .pcl,.prow.zero .ps{opacity:.4}
 .ptot{font-size:12px;color:var(--mut);margin:11px 0 0;padding-top:10px;border-top:1px solid var(--line)}

 /* 견적 */
 .qrow{display:flex;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px}
 .qrow:last-of-type{border-bottom:0}
 .qrow .qt{flex:none;font-weight:600}
 .qrow .qd{flex:1;font-size:11.5px;color:var(--mut);line-height:1.5}
 .qrow .qa{flex:none;font-variant-numeric:tabular-nums}
 .qrow .qa.ask{color:var(--mut);font-size:12px}
 .qsum{display:flex;justify-content:space-between;align-items:baseline;
  margin-top:11px;padding-top:11px;border-top:1.5px solid var(--fg);font-size:13.5px}
 .qsum b{font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
 .qnote{font-size:11.5px;color:var(--mut);margin:9px 0 0;line-height:1.65}

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
    <p class="d">①에서 고르신 <b>네 칸이 곧 주문하실 베개커버</b>입니다.
      칸마다 사이즈와 장수를 골라주세요 — 안 사실 칸은 <b>0장</b>.<br>
      사이즈는 쓰시는 베개 기준입니다. 베개 사신 곳에 나와 있는 숫자면 됩니다.
      목록에 없으면 「${PIL_ASK}」를 고르고 아래 <b>남기실 말</b>에 적어주세요.</p>
    <div id="grpPil">
${PILLOWS.map(p=>`      <div class="prow" data-part="${p.key}">
        <span class="pdot" data-part="${p.key}" style="background:${p.def}"></span>
        <div class="pmain">
          <div class="pnm">${p.ko}</div>
          <div class="pcl" data-part="${p.key}">-</div>
          <div class="psel">
            <select class="ps" data-part="${p.key}" aria-label="${p.ko} 사이즈">${PILLOW.map(o=>`<option${o==='50×70'?' selected':''}>${o}</option>`).join('')}</select>
            <select class="pq" data-part="${p.key}" aria-label="${p.ko} 장수">${PIL_QTY.map(n=>`<option value="${n}"${n===p.qty?' selected':''}>${n}장</option>`).join('')}</select>
          </div>
        </div>
      </div>`).join('\n')}
      <p class="ptot" id="pTot"></p>
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
${PRICE_READY ? `  <div class="card">
    <h2>예상 금액</h2>
    <p class="d">안내용 예상 금액입니다. 최종 금액은 문의 주시면 확정해 드립니다.</p>
    <div id="qRows"></div>
    <div class="qsum" id="qSumBox"><span>합계</span><b id="qSum">-</b></div>
    <p class="qnote" id="qNote"></p>
  </div>
` : ''}  <pre id="orderTxt"></pre>
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
const PRICE = ${JSON.stringify(PRICE)};
const ALWAYS_CUSTOM = ${ALWAYS_CUSTOM};
const PRICE_READY = ${PRICE_READY};
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
  if (s === 1) renderPillows();
  if (s === 2) { buildMini(); renderQuote(); renderOrder(); }
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

/* ---- 베개커버: ①에서 고른 네 칸이 곧 장수다 ---- */
const PILLOWS = PARTS.filter(p => p.qty !== undefined);
const pq = k => +$('.pq[data-part="' + k + '"]').value;
const ps = k => $('.ps[data-part="' + k + '"]').value;
const pillowCount = () => PILLOWS.reduce((s, p) => s + pq(p.key), 0);
const pillowRows = () => PILLOWS.map(p => ({ p, c:state[p.key], size:ps(p.key), n:pq(p.key) })).filter(r => r.n > 0);
// 사이즈마다 값이 다르니 사이즈별로 묶어서 센다. 순서는 화면에 나온 순서 그대로.
function pillowBySize(){
  const g = new Map();
  pillowRows().forEach(r => g.set(r.size, (g.get(r.size) || 0) + r.n));
  return [...g];
}
function renderPillows(){
  PILLOWS.forEach(p => {
    $('.pdot[data-part="' + p.key + '"]').style.background = state[p.key].hex;
    $('.pcl[data-part="' + p.key + '"]').textContent = label(state[p.key]);
    $('.prow[data-part="' + p.key + '"]').classList.toggle('zero', pq(p.key) === 0);
  });
  const n = pillowCount();
  $('#pTot').textContent = !n ? '전부 0장 — 베개커버는 주문하지 않는 것으로 봅니다'
    : '모두 ' + n + '장  ·  ' + pillowBySize().map(([s, c]) => s + ' ' + c + '장').join(', ');
}
$$('.pq, .ps').forEach(s => s.onchange = renderPillows);

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
/* ---- 견적 ----
   판매가와 맞춤 추가금이 둘 다 있어야 금액이 나온다.
   하나라도 비었거나 수량·사이즈가 확정되지 않으면 그 줄은 "가격 문의"로 두고 합계에서 뺀다. */
const won = n => n.toLocaleString('ko-KR') + '원';
function quote(){
  const rows = [], notes = [];
  let sum = 0, ask = false;
  const add = r => { rows.push(r); if (r.ask) ask = true; else sum += r.a; };
  const fee = (sale, custom) =>
    sale == null || (ALWAYS_CUSTOM && custom == null) ? null : sale + (ALWAYS_CUSTOM ? custom : 0);

  if (!$('#q_skip').checked) {
    const d = $('#q_size').value, p = fee(PRICE.quilt.sale[d], PRICE.quilt.custom);
    add(p == null ? { t:'이불', d, ask:'가격 문의' } : { t:'이불', d, a:p });
  }
  if (!$('#m_skip').checked) {
    const size = $('#m_size').value;
    let p = fee(PRICE.mattress.sale[size], PRICE.mattress.custom), d = size;
    const hb = PRICE.mattress.heightBase, ha = PRICE.mattress.heightAdd;
    if (p != null && hb != null && ha != null) {
      const h = parseFloat($('#m_h').value);
      if (!Number.isFinite(h)) notes.push('매트리스 높이를 적어주세요. ' + hb + 'cm를 넘으면 ' + won(ha) + '이 더 붙습니다.');
      else if (h > hb) { p += ha; d += ' · 높이 ' + h + 'cm (' + hb + 'cm 초과)'; }
    }
    add(p == null ? { t:'매트리스커버', d, ask:'가격 문의' } : { t:'매트리스커버', d, a:p });
  }
  if (!$('#p_skip').checked) {
    // 사이즈마다 값이 다르므로 사이즈별로 한 줄씩 낸다. '그 외'만 문의로 빠질 수 있다.
    for (const [size, n] of pillowBySize()) {
      const unit = fee(PRICE.pillow.sale[size], PRICE.pillow.custom);
      const d = size + ' · ' + n + '장';
      // k = 줄이 여럿일 때 구분하는 꼬리표. 복사 텍스트에서 "베개커버"만 두 줄 나오는 걸 막는다.
      add(unit == null ? { t:'베개커버', k:size, d, ask:'가격 문의' } : { t:'베개커버', k:size, d, a:unit * n });
    }
  }
  if (rows.length && ALWAYS_CUSTOM) notes.unshift('맞춤 제작 추가금이 포함된 금액입니다.');
  return { rows, sum, ask, notes };
}
function renderQuote(){
  if (!PRICE_READY) return;
  const { rows, sum, ask, notes } = quote();
  $('#qRows').innerHTML = rows.map(r =>
    '<div class="qrow"><span class="qt">' + r.t + '</span><span class="qd">' + r.d + '</span>' +
    (r.ask ? '<span class="qa ask">' + r.ask + '</span>' : '<span class="qa">' + won(r.a) + '</span>') +
    '</div>').join('');
  const priced = rows.some(r => !r.ask);
  $('#qSumBox').style.display = priced ? '' : 'none';
  $('#qSum').textContent = won(sum) + (ask ? ' + 문의' : '');
  $('#qNote').innerHTML = notes.map(n => '· ' + n).join('<br>');
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
  if (!$('#p_skip').checked && pillowCount()) {
    L.push('■ 베개커버',
      ...pillowRows().map(r => '   ' + r.p.ko + ' : ' + r.size + ' · ' + r.n + '장  /  ' + label(r.c)),
      '   모두 ' + pillowCount() + '장 (' + pillowBySize().map(([s,c]) => s + ' ' + c + '장').join(', ') + ')', '');
  }
  if (PRICE_READY) {
    const q = quote();
    if (q.rows.length) {
      L.push('■ 예상 금액');
      q.rows.forEach(r => L.push('   ' + r.t + (r.k ? ' ' + r.k : '') + ' : ' + (r.ask ? r.ask : won(r.a))));
      if (q.rows.some(r => !r.ask)) L.push('   합계 : ' + won(q.sum) + (q.ask ? ' + 문의' : ''));
      L.push('   ※ 안내용 예상 금액입니다.', '');
    }
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
