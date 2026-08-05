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

// 팔레트에서 빼는 색 — 번호로 적는다.
// swatches.json 은 컬러차트를 그대로 옮긴 것이라 손대지 않는다. 차트에는 있지만
// 팔지 않는 색은 여기서 뺀다. 원본을 지우면 차트를 다시 뽑을 때 어긋난다.
//   953·903 클라우드 화이트 — 60수·80수가 완전히 같은 값(#f5f5f5)이라 화면에서 구별되지
//   않는데다, 실제로 쓰지 않는 화이트다. [대표, 2026-08-05]
const EXCLUDE = ['953', '903'];
{
  const before = Object.values(SW).reduce((s, g) => s + g.colors.length, 0);
  const found = new Set();
  for (const g of Object.values(SW)) {
    g.colors = g.colors.filter(c => {
      if (!EXCLUDE.includes(c.no)) return true;
      found.add(c.no); return false;
    });
  }
  // 지우려던 번호가 없으면 조용히 넘어가지 않는다. 오타거나 차트가 바뀐 것이다.
  const missing = EXCLUDE.filter(no => !found.has(no));
  if (missing.length) throw new Error(`EXCLUDE 의 번호가 swatches.json 에 없습니다: ${missing.join(', ')}`);
  console.log(`팔레트 제외 ${EXCLUDE.length}색 — ${before}색 → ${before - EXCLUDE.length}색`);
}

// 컬러차트에 번호가 잘못 찍힌 칩을 바로잡는다. 이름으로 색을 집고 번호만 고친다.
// swatches.json 은 차트를 그대로 옮긴 원본이라 손대지 않는다 — 차트를 다시 뽑으면
// 틀린 번호가 그대로 다시 들어오므로 이 표는 계속 남아 있어야 한다.
//   다크 그린   — 차트에 2027 로 찍혀 있으나 2027 은 애프터 다크다. 2029 가 맞다.  [대표, 2026-08-05]
//   코코아 그레이 — 차트에 2023 으로 찍혀 있으나 2023 은 쿨 라벤더다. 2031 이 맞다. [대표, 2026-08-05]
// 100수는 2001~2032 연속 32번인데 2029·2031 이 비어 있었고 번호가 겹치는 색이 둘이라
// 수가 정확히 맞았다. 나잇 그린의 2026 은 차트가 맞다 [대표].
const NO_FIX = [
  { ko:'다크 그린',   from:'2027', to:'2029' },
  { ko:'코코아 그레이', from:'2023', to:'2031' },
];
for (const f of NO_FIX) {
  const hit = Object.values(SW).flatMap(g => g.colors).filter(c => c.ko === f.ko && c.no === f.from);
  if (hit.length !== 1)
    throw new Error(`NO_FIX: "${f.ko}" NO.${f.from} 을 ${hit.length}개 찾았습니다 (1개여야 합니다)`);
  const taken = Object.values(SW).flatMap(g => g.colors).find(c => c.no === f.to);
  if (taken) throw new Error(`NO_FIX: NO.${f.to} 는 이미 ${taken.ko} 가 쓰고 있습니다`);
  hit[0].no = f.to;
  console.log(`번호 정정 — ${f.ko}  NO.${f.from} → NO.${f.to}`);
}

// 번호는 팔레트 안에서 고유해야 한다. 겹치면 주문서에서 어느 색인지 가려낼 수 없다.
// 조용히 넘어가면 결제·발주가 엉뚱한 색으로 나가므로 여기서 멈춘다. [2026-08-05]
{
  const seen = {};
  for (const c of Object.values(SW).flatMap(g => g.colors)) (seen[c.no] = seen[c.no] || []).push(c);
  const dup = Object.entries(seen).filter(([, v]) => v.length > 1);
  if (dup.length) throw new Error('번호가 겹칩니다 — build.js 의 NO_FIX 에서 바로잡으십시오:\n'
    + dup.map(([no, v]) => `  NO.${no}: ${v.map(c => c.ko + ' ' + c.su + '수').join(' / ')}`).join('\n'));
}

// 베개 위치: 앞줄 왼쪽=pillowF, 앞줄 오른쪽=pillowR, 뒷줄 왼쪽=pillowL, 뒷줄 오른쪽=pillowW
// 처음엔 여섯 곳 모두 흰색이다. 색이 미리 들어가 있으면 자기 색을 얹는 자리라는 게
// 안 보이고, 고르지도 않은 색이 주문에 딸려 나간다. [대표, 2026-08-04]
// 시작 색은 매트리스커버에서도 고를 수 있어야 한다 — 100수는 매트리스커버에 못 쓰므로
// 반드시 60수나 80수인 색이어야 한다. 아니면 매트리스커버를 누르는 순간 시작 색이 사라진다.
// 클라우드 화이트(953·80수 903)를 팔레트에서 빼면서 남은 화이트 중 가장 밝은 색으로 옮겼다.
// [대표, 2026-08-05]
const WHITE = '#f5f4ef';   // NO. 952 멜트 아이스크림 60수
// qty = 베개커버 기본 장수. 앞줄 둘만 1장으로 두면 흔한 경우(2장)가 기본이 된다.
const PARTS = [
  { key:'quilt',    ko:'이불',            def:WHITE, su:null },
  { key:'mattress', ko:'매트리스커버',     def:WHITE, su:[60,80] },
  { key:'pillowF',  ko:'베개(앞)-왼쪽',    def:WHITE, su:null, qty:1 },
  { key:'pillowR',  ko:'베개(앞)-오른쪽',  def:WHITE, su:null, qty:1 },
  { key:'pillowL',  ko:'베개(뒤)-왼쪽',    def:WHITE, su:null, qty:0 },
  { key:'pillowW',  ko:'베개(뒤)-오른쪽',  def:WHITE, su:null, qty:0 },
];
// 부위별 시작 색이 그 부위에서 실제로 고를 수 있는 색이어야 한다.
// 팔레트에 아예 없으면 "직접 지정" 같은 유령 색으로 시작하고,
// 번수 제한에 걸리면 그 부위를 누르는 순간 시작 색이 목록에서 사라진다.
for (const p of PARTS) {
  const hit = Object.values(SW).flatMap(g => g.colors).filter(c => c.hex === p.def);
  if (!hit.length)
    throw new Error(`${p.ko} 시작 색 ${p.def} 이 팔레트에 없습니다 (EXCLUDE 로 뺐는지 확인)`);
  if (p.su && !hit.some(c => p.su.includes(c.su)))
    throw new Error(`${p.ko} 시작 색 ${p.def} 은 ${hit.map(c=>c.su+'수').join('·')} 뿐이라 `
      + `${p.su.join('·')}수만 되는 이 부위에서 고를 수 없습니다`);
}
const PILLOWS = PARTS.filter(p => p.qty !== undefined);

// 이불 = 완제품 크기 / 매트리스커버 = 침대 규격. 체계가 다르다 [대표, 2026-08-04]
// 견적을 내려면 모든 선택지가 가격을 가져야 하므로 "잘 모르겠습니다" 류는 두지 않는다 [대표]
const QUILT = ['슈퍼싱글 150×210','퀸 200×230','킹 220×240','라지킹 240×240'];
const MAT = ['싱글 100×200','슈퍼싱글 110×200','120×200','퀸 150×200','160×200','170×200',
  '180×200','190×200','200×200','220×200'];
const OZ = ['여름용 (4온스)','초여름·간절기용 (6온스)','간절기용 (8온스)','한겨울용 (10온스)'];
// 사이즈·수량 모두 4칸에서 각각 받는다. 40×60과 50×70을 섞어 쓰는 집이 있고,
// 수량을 따로 받으면 "4색을 골랐는데 2장" 처럼 어느 색인지 알 수 없어진다 [대표, 2026-08-04]
const PIL_ASK = '그 외';                       // 사이즈가 정해지지 않아 값을 못 내는 선택지
const PILLOW = ['40×60','50×70',PIL_ASK];
const PIL_QTY = [0,1,2,3,4];
// 이불·매트리스커버 장수. 0은 없다 — 안 살 때는 「안 할래요」로 끈다.
const ITEM_QTY = [1,2,3,4];

// 팔레트에서 어느 칸이 골라졌는지 가리키는 키. 색상값도 번호도 겹치는 색이 있어서
// (#edece7 머슬린 화이트 80·100수, #d8baaf 세피아 로즈/드라이 페탈, NO.2023 두 색)
// 둘 다 기준으로 못 쓴다. [2026-08-04]
// 이 키는 팔레트 순번이라 색이 늘거나 빠지면 값이 밀린다. 화면 안에서만 쓰고,
// 주문 기록처럼 오래 남는 곳에 저장하면 안 된다. 저장에는 번호+이름을 쓴다. [2026-08-05]
let ki = 0;
for (const g of Object.values(SW)) g.colors.forEach(c => c.k = 'c' + (ki++));

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
  quilt: {                 // 차렵이불 정상가 [대표, 2026-08-04]
    sale: {
      '슈퍼싱글 150×210': 195000,
      '퀸 200×230':       265000,
      '킹 220×240':       290000,
      '라지킹 240×240':   340000,
    },
    custom: 10000,         // 이불 맞춤 추가금 (1장당). 사이즈 무관 [대표, 2026-08-04]
  },
  mattress: {              // 매트리스커버 정상가. 기준가 14만원 [대표, 2026-08-04]
    sale: {
      '싱글 100×200':     140000,
      '슈퍼싱글 110×200': 140000,
      '120×200':          145000,
      '퀸 150×200':       155000,
      '160×200':          170000,
      '170×200':          180000,
      '180×200':          195000,
      '190×200':          220000,
      '200×200':          240000,
      '220×200':          260000,
    },
    custom: 10000,         // 매트리스커버 맞춤 추가금 (1장당). 사이즈 무관 [대표, 2026-08-04]
    // 높이 추가금 구간. 위에서부터 보다가 upto 이하인 첫 칸을 쓴다.
    // 마지막 칸(65cm)이 곧 받을 수 있는 최대 높이다. 그보다 높으면 주문을 받지 않는다. [대표, 2026-08-04]
    height: [
      { upto: 35, add: 0 },
      { upto: 45, add: 15000 },
      { upto: 55, add: 25000 },
      { upto: 65, add: 35000 },
    ],
  },
  pillow: {                // 사이즈와 무관하게 같은 값 [대표, 2026-08-04]
    sale: {                // '그 외'는 사이즈가 정해지지 않으니 가격도 못 낸다 → 문의
      '40×60': 26000,
      '50×70': 26000,
    },
    custom: 3000,          // 베개커버 맞춤 추가금 (1장당). 사이즈 무관 [대표, 2026-08-04]
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

// 높이 구간은 낮은 것부터 와야 한다. 뒤집히면 엉뚱한 칸이 먼저 걸린다.
const HT = PRICE.mattress.height || [];
HT.forEach((t, i) => {
  if (i && t.upto <= HT[i-1].upto)
    throw new Error(`PRICE.mattress.height 는 낮은 높이부터 적어야 합니다 (${HT[i-1].upto} 다음에 ${t.upto})`);
});
// 안내 문구는 표에서 만든다. 손으로 적어두면 표만 고쳤을 때 어긋난다.
const H_MAX = HT.length ? HT[HT.length - 1].upto : null;   // 받을 수 있는 최대 높이
const HT_TEXT = HT.map((t, i) =>
  (i ? `~${t.upto}cm` : `${t.upto}cm까지`) + (t.add ? ` +${t.add.toLocaleString('ko-KR')}원` : ' 추가 없음')
).join(' · ');

const hasPrice = o => Object.values(o).some(v => v && typeof v === 'object' ? hasPrice(v) : v != null);
const PRICE_READY = hasPrice(PRICE);

const total = Object.values(SW).reduce((s,g)=>s+g.colors.length,0);

const html = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>파마파미 컬러 시뮬레이터</title>
<style>
 :root{--bg:#faf9f7;--fg:#2b2724;--mut:#8a827b;--line:#e6e1da;--card:#fff;--soft:#f2efea;--bad:#b5342a}
 @media (prefers-color-scheme:dark){:root{--bg:#17150f;--fg:#ece7df;--mut:#9c948a;--line:#2f2a24;--card:#201d17;--soft:#262219;--bad:#ff9384}}
 :root[data-theme="dark"]{--bg:#17150f;--fg:#ece7df;--mut:#9c948a;--line:#2f2a24;--card:#201d17;--soft:#262219;--bad:#ff9384}
 :root[data-theme="light"]{--bg:#faf9f7;--fg:#2b2724;--mut:#8a827b;--line:#e6e1da;--card:#fff;--soft:#f2efea;--bad:#b5342a}
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
 .warn{font-size:12px;color:var(--bad);font-weight:600;margin:2px 0 0;line-height:1.55}
 .warn[hidden]{display:none}
 .fld input.bad,.fld select.bad{border-color:var(--bad);outline:1px solid var(--bad);outline-offset:-2px}

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
 .qrow .qa.bad{color:var(--bad);font-weight:600}
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
  <p class="sub">지금은 여섯 곳 모두 흰색입니다. 부위를 눌러 원단 ${total}색 중에서 바꿔보세요.</p>
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
      <div class="fld"><label>수량</label><select id="q_qty">${ITEM_QTY.map(n=>`<option value="${n}">${n}장</option>`).join('')}</select></div>
    </div>
    <label class="skip"><input type="checkbox" id="q_skip"> 이불은 안 할래요</label>
  </div>

  <div class="card">
    <h2>매트리스커버</h2>
    <p class="d">매트리스 실제 사이즈가 필요합니다. <b>재실 필요 없습니다</b> — 사신 곳에 나와 있는 숫자를 적어주세요.
      <br>값은 고르신 <b>침대 규격</b>으로 정해집니다. 가로×세로는 만들 때 쓰는 치수입니다.
${HT.length ? `      <br>높이에 따라 값이 달라집니다 — ${HT_TEXT}.
      <b>높이 ${H_MAX}cm까지만 주문받습니다.</b>` : ''}</p>
    <div id="grpMat">
      <div class="fld"><label>침대 규격 (값의 기준)</label><select id="m_size">${MAT.map(o=>`<option${o==='퀸 150×200'?' selected':''}>${o}</option>`).join('')}</select></div>
      <div class="two">
        <div class="fld"><label>가로 × 세로 (cm)</label><input id="m_wh" type="text" inputmode="numeric" placeholder="예: 150x200"></div>
        <div class="fld"><label>높이 (cm)</label><input id="m_h" type="text" inputmode="numeric" placeholder="예: 30"></div>
      </div>
      <p class="warn" id="m_hWarn" hidden></p>
      <div class="fld"><label>수량</label><select id="m_qty">${ITEM_QTY.map(n=>`<option value="${n}">${n}장</option>`).join('')}</select></div>
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
  <p class="ordnote">
    ${PRICE_READY ? `<b>위 금액은 안내용입니다.</b> 맞춤 추가금까지 넣은 금액이지만,
    원단 사정이나 실제 치수에 따라 조금 달라질 수 있습니다.
    복사해서 문의 주시면 최종 금액을 확정해 드립니다.` :
    `<b>기성 상품에 없는 조합은 맞춤 제작입니다.</b> 복사해서 문의 주시면 금액을 안내드립니다.`}<br><br>
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
const PIL_ASK = ${JSON.stringify(PIL_ASK)};
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
  if (s === 1) { renderPillows(); checkHeight(); }
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
    // 색상값이 같은 색이 있어서 hex 로 비교하면 두 칸이 같이 켜진다. 고유 키로 본다.
    b.setAttribute('aria-current', ok && b.dataset.k === c.k);
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
    b.style.background = c.hex; b.dataset.k = c.k; b.dataset.su = c.su;
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

/* ---- 매트리스 높이: 받을 수 있는 최대 높이를 넘으면 그 자리에서 알린다 ---- */
const HT_ALL = PRICE.mattress.height || [];
const H_MAX = HT_ALL.length ? HT_ALL[HT_ALL.length - 1].upto : null;
// 적힌 높이를 읽는다. 비었거나 숫자가 아니거나 0 이하면 null.
function height(){
  const raw = $('#m_h').value.trim();
  if (!raw) return null;
  const h = parseFloat(raw);
  return Number.isFinite(h) && h > 0 ? h : null;
}
const heightTyped = () => $('#m_h').value.trim() !== '';
const heightJunk  = () => heightTyped() && height() == null;   // 적긴 했는데 못 읽는 값
const tooTall     = () => { const h = height(); return H_MAX != null && h != null && h > H_MAX; };

function checkHeight(){
  const off = $('#m_skip').checked;
  const junk = !off && heightJunk(), tall = !off && tooTall();
  $('#m_h').classList.toggle('bad', junk || tall);
  const w = $('#m_hWarn');
  w.hidden = !(junk || tall);
  w.textContent = junk
    ? '높이를 숫자로 적어주세요. (예: 30)'
    : tall
    ? '높이 ' + H_MAX + 'cm까지만 주문받습니다. 이 매트리스커버는 만들어 드릴 수 없습니다 — 「매트리스커버는 안 할래요」로 넘어가 주세요.'
    : '';
}
$('#m_h').oninput = checkHeight;

/* ---- 사이즈: 안 할래요 체크 시 비활성 ---- */
[['q_skip','grpQuilt'],['m_skip','grpMat'],['p_skip','grpPil']].forEach(([c,g]) => {
  $('#'+c).onchange = e => { $('#'+g).classList.toggle('off', e.target.checked); checkHeight(); };
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
  let sum = 0, ask = false, bad = false;
  const add = r => { rows.push(r); if (r.bad) bad = true; else if (r.ask) ask = true; else sum += r.a; };
  const fee = (sale, custom) =>
    sale == null || (ALWAYS_CUSTOM && custom == null) ? null : sale + (ALWAYS_CUSTOM ? custom : 0);

  if (!$('#q_skip').checked) {
    const size = $('#q_size').value, n = +$('#q_qty').value;
    const p = fee(PRICE.quilt.sale[size], PRICE.quilt.custom);
    const d = size + (n > 1 ? ' · ' + n + '장' : '');
    add(p == null ? { t:'이불', d, ask:'가격 문의' } : { t:'이불', d, a:p * n });
  }
  if (!$('#m_skip').checked) {
    const size = $('#m_size').value, n = +$('#m_qty').value;
    let unit = fee(PRICE.mattress.sale[size], PRICE.mattress.custom), d = size, tall = false;
    if (unit != null && HT_ALL.length) {
      const h = height();
      if (h == null) {
        notes.push(heightJunk()
          ? '매트리스 높이를 숫자로 적어주세요. 지금은 높이 추가금 없이 계산했습니다.'
          : '매트리스 높이를 적어주세요. ' + HT_ALL[0].upto + 'cm까지는 추가금이 없고, 넘으면 높이에 따라 더 붙습니다.');
      } else {
        const t = HT_ALL.find(t => h <= t.upto);
        d += ' · 높이 ' + h + 'cm';
        if (!t) { tall = true; notes.push('매트리스 높이는 ' + H_MAX + 'cm까지만 주문받습니다. 이 매트리스커버는 만들어 드릴 수 없습니다.'); }
        else if (t.add) { unit += t.add; d += ' (+' + won(t.add) + ')'; }
      }
    }
    if (!$('#m_wh').value.trim()) notes.push('매트리스 가로×세로를 적어주세요. 만들 때 쓰는 치수입니다.');
    if (n > 1) d += ' · ' + n + '장';
    add(tall ? { t:'매트리스커버', d, ask:'주문 불가', bad:true }
      : unit == null ? { t:'매트리스커버', d, ask:'가격 문의' } : { t:'매트리스커버', d, a:unit * n });
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
  if (!$('#p_skip').checked && pillowRows().some(r => r.size === PIL_ASK) && !$('#memo').value.trim())
    notes.push('「' + PIL_ASK + '」로 고르신 베개 사이즈를 「남기실 말」에 적어주세요.');
  if (rows.length && ALWAYS_CUSTOM) notes.unshift('맞춤 제작 추가금이 포함된 금액입니다.');
  return { rows, sum, ask, bad, notes };
}
function renderQuote(){
  if (!PRICE_READY) return;
  const { rows, sum, ask, notes } = quote();
  $('#qRows').innerHTML = rows.map(r =>
    '<div class="qrow"><span class="qt">' + r.t + '</span><span class="qd">' + r.d + '</span>' +
    (r.ask ? '<span class="qa ask' + (r.bad ? ' bad' : '') + '">' + r.ask + '</span>'
           : '<span class="qa">' + won(r.a) + '</span>') +
    '</div>').join('');
  const priced = rows.some(r => !r.ask);
  $('#qSumBox').style.display = priced ? '' : 'none';
  // 주문 불가한 줄은 합계에서 빠진 것이지 문의로 넘어간 게 아니다.
  $('#qSum').textContent = won(sum) + (ask ? ' + 문의' : '');
  $('#qNote').innerHTML = notes.map(n => '· ' + n).join('<br>');
}

function renderOrder(){
  const L = [];
  if (!$('#q_skip').checked) L.push('■ 이불', '   사이즈 : ' + $('#q_size').value,
    '   두께 : ' + $('#q_oz').value, '   수량 : ' + $('#q_qty').value + '장',
    '   컬러 : ' + label(state.quilt), '');
  if (!$('#m_skip').checked) {
    const wh = $('#m_wh').value.trim(), h = $('#m_h').value.trim();
    L.push('■ 매트리스커버', '   규격 : ' + $('#m_size').value, '   수량 : ' + $('#m_qty').value + '장');
    if (wh || h) L.push('   실제 사이즈 : ' + (wh||'-') + (h ? ' / 높이 ' + h : ''));
    L.push('   컬러 : ' + label(state.mattress));
    if (tooTall()) L.push('   ※ 높이 ' + H_MAX + 'cm까지만 주문받습니다 — 이 매트리스커버는 만들어 드릴 수 없습니다');
    L.push('');
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
      L.push('   ※ 안내용 예상 금액입니다.');
      q.notes.forEach(n => L.push('   ※ ' + n));
      L.push('');
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
// 컬러 데이터도 저장소 루트에 공개용으로 함께 내보낸다.
// k 는 페이지 안에서만 쓰는 키라 공개 파일에서는 뺀다.
fs.writeFileSync(path.join(ROOT, 'colors.json'),
  JSON.stringify(SW, (key, v) => key === 'k' ? undefined : v, 1), 'utf8');

const kb = Math.round(fs.statSync(path.join(ROOT,'index.html')).size / 1024);
console.log(`index.html 생성 — 원단 ${total}색 / 부위 ${PARTS.length}곳 / 3단계 / ${kb}KB`);
