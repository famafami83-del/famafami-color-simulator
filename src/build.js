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

// 디자인 — **사진이 서로 다르다.** 무지는 침대를 옆에서 본 컷, 양면은 위에서 비스듬히
// 본 세로 컷이다. 그래서 디자인마다 바탕 사진 한 장과 마스크 한 벌을 따로 갖는다.
//   양면을 이 컷으로 옮긴 이유 — 베개 앞뒤가 한 장에 같이 보인다. 뒤 베개는 겉이 앞면색,
//   앞 베개는 겉이 뒷면색이라 젖혀 놓은 모양이다. 무지 컷은 베개가 다 윗면만 보여서
//   양면 베개를 흉내낼 수가 없었다. [대표, 2026-08-06]
//   맞바꾼 것 — 양면에서는 **이불과 베개를 따로 못 고른다.** 색 사진이 전부 베개를 이불과
//   같은 색으로 칠해놔서 둘을 가를 수가 없다. 대표가 원한 것이 그것이라 그대로 두었다.
//   자세한 것은 `src/tools/split-piping.js` 머리말에 적어두었다.
// base   = 그 디자인의 바탕 사진. 침구가 전부 흰색인 컷이다.
// card   = 고르는 화면에 걸리는 사진. `src/tools/design-cards.js` 가 만든다.
// pilTwo = 「베개커버도 앞뒤를 다르게」 칸을 보일지. 양면 디자인에서만 묻는다.
const DESIGNS = [
  { key:'plain', ko:'무지', d:'이불 앞뒤가 같은 색',     card:'card_plain.jpg', base:'base.jpg' },
  { key:'both',  ko:'양면', d:'이불 앞뒤를 다른 색으로', card:'card_both.jpg',  base:'base_both.jpg',
    pilTwo:true },
];
// 디자인을 바꿔도 **고른 색이 날아가지 않게** 물려준다. 다시 고르게 하면 카드를 둔 뜻이 없다.
// 그 부위에 아직 손을 안 댔을 때만 물려준다 — 갈 때마다 덮으면 무지↔양면을 오가는 사이에
// 양면에서 고른 뒷면 색이 앞면 색으로 지워진다.
//   베개 색은 못 물려준다. 무지는 베개가 네 부위고 양면은 이불과 한 몸이라 짝이 없다.
const CARRY = {
  both:  { bothA:'quilt', bothB:'quilt', bothM:'mattress' },  // 무지 → 양면 : 앞뒤 모두 쓰던 색으로
  plain: { quilt:'bothA', mattress:'bothM' },                 // 양면 → 무지 : 앞면 색을 가져온다
};
// dz     = 이 부위가 나오는 디자인. 없으면 모든 디자인에 나온다.
// grp    = 주문서에서 한 덩어리로 묶는 이름. 양면이면 이불이 두 부위라 묶을 데가 필요하다.
// face   = 주문서에 「컬러(앞면)」처럼 붙일 말. 한 면뿐이면 없다.
// follow = 손님이 고르지 않고 **다른 부위 색을 따라가는** 자리. 단추도 안 만든다.
const PARTS = [
  // ── 무지 (base.jpg)
  { key:'quilt',    ko:'이불',            def:WHITE, su:null,     dz:['plain'], grp:'quilt' },
  { key:'mattress', ko:'매트리스커버',     def:WHITE, su:[60,80], dz:['plain'], grp:'mat' },
  { key:'pillowF',  ko:'베개(앞)-왼쪽',    def:WHITE, su:null,     dz:['plain'] },
  { key:'pillowR',  ko:'베개(앞)-오른쪽',  def:WHITE, su:null,     dz:['plain'] },
  { key:'pillowL',  ko:'베개(뒤)-왼쪽',    def:WHITE, su:null,     dz:['plain'] },
  { key:'pillowW',  ko:'베개(뒤)-오른쪽',  def:WHITE, su:null,     dz:['plain'] },
  // ── 양면 (base_both.jpg). 이불과 베개가 한 부위다 — 이름에 그렇게 적어둔다.
  { key:'bothA',    ko:'이불·베개 앞면',   def:WHITE, su:null,     dz:['both'], grp:'quilt', face:'앞면' },
  { key:'bothB',    ko:'이불·베개 뒷면',   def:WHITE, su:null,     dz:['both'], grp:'quilt', face:'뒷면' },
  { key:'bothM',    ko:'매트리스커버',     def:WHITE, su:[60,80], dz:['both'], grp:'mat' },
  // 삥(테두리)은 사진에만 있고 이 제품에는 없다. 앞면 색으로 덮어 안 보이게 한다.
  //   ★ 삥 제품을 팔게 되면 follow 를 지우고 DESIGNS 에 카드 한 장만 더하면 된다.
  //     마스크도 사진도 이미 들어 있어 용량이 늘지 않는다.
  { key:'bothP',    ko:'삥(테두리)',       def:WHITE, su:null,     dz:['both'], follow:'bothA' },
];
const inDz  = (p, d) => !p.dz || p.dz.includes(d);
const pickable = p => !p.follow;          // 손님이 눌러서 고르는 부위인가
// 마스크가 없는 부위를 적어두면 그 자리만 색이 안 먹는 페이지가 조용히 나간다.
for (const p of PARTS)
  if (!fs.existsSync(path.join(ASSETS, `mask_${p.key}.png`)))
    throw new Error(`${p.ko}(${p.key}) 마스크가 없습니다 — src/tools/ 의 마스크 도구를 돌리셨습니까`);
for (const d of DESIGNS)
  for (const [what, f] of [['카드 사진', d.card], ['바탕 사진', d.base]])
    if (!fs.existsSync(path.join(ASSETS, f)))
      throw new Error(`${d.ko} ${what}(${f})이 없습니다 — src/tools/ 의 도구를 돌리셨습니까`);
// 물려주기가 가리키는 부위가 실제로 있어야 한다.
for (const [d, m] of Object.entries(CARRY))
  for (const [to, from] of Object.entries(m))
    if (!PARTS.some(p => p.key === to) || !PARTS.some(p => p.key === from))
      throw new Error(`CARRY.${d} 의 ${to}←${from} 가 PARTS 에 없습니다`);
// 따라가는 자리가 없는 부위를 가리키면 그 자리만 흰색으로 남는다.
for (const p of PARTS)
  if (p.follow && !PARTS.some(q => q.key === p.follow))
    throw new Error(`${p.ko}(${p.key}) 가 없는 부위 ${p.follow} 를 따라갑니다`);
// 디자인마다 이불 부위와 매트리스커버 부위가 있어야 주문서가 채워진다.
for (const d of DESIGNS) {
  const own = PARTS.filter(p => inDz(p, d.key));
  if (!own.some(p => p.grp === 'quilt')) throw new Error(`${d.ko} 에 이불 부위(grp:'quilt')가 없습니다`);
  if (own.filter(p => p.grp === 'mat').length !== 1)
    throw new Error(`${d.ko} 의 매트리스커버 부위(grp:'mat')는 정확히 하나여야 합니다`);
}
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
// 베개 칸 — **사이즈와 장수를 받는 단위**다. 부위(색을 칠하는 자리)와 다르다.
// 이불이 양면이라고 베개커버까지 양면인 것은 아니다. **따로 받는다** [대표, 2026-08-06].
//   single    : 무지. 사진의 베개 네 개를 각각 한 장씩 고른다 → 네 칸, 한 칸에 한 색
//   bothTwo   : 양면 + 베개도 양면. 한 장이 앞면·뒷면 두 색 → **한 칸**
//   bothPlain : 양면인데 베개는 무지. 앞면 색 한 가지로 나간다 → **한 칸**
// **양면은 칸이 하나다** [대표, 2026-08-06]. 베개 색이 이불과 한 몸이라 칸을 둘로 나눠봐야
// 두 칸의 색이 늘 똑같다. 고를 것이 없는 칸을 둘씩 보여줄 이유가 없다.
// 그래도 칸 자체는 있어야 한다 — **사이즈와 장수를 받는 자리**이기 때문이다.
//   ★ 칸 이름(key)이 무지와 다르다. 그래야 무지의 네 칸과 양면의 한 칸이 서로
//     적어둔 값을 덮지 않고 각각 살아남는다.
// faces = 이 칸의 색이 어느 부위에서 오는지. 둘이면 앞면·뒷면이다.
const PIL_MODES = {
  single: [
    { key:'L',  ko:'베개(앞)-왼쪽',   qty:1, faces:[{ part:'pillowF' }] },
    { key:'R',  ko:'베개(앞)-오른쪽', qty:1, faces:[{ part:'pillowR' }] },
    { key:'L2', ko:'베개(뒤)-왼쪽',   qty:0, faces:[{ part:'pillowL' }] },
    { key:'R2', ko:'베개(뒤)-오른쪽', qty:0, faces:[{ part:'pillowW' }] },
  ],
  // 한 칸이 네 칸 몫을 하므로 장수 목록을 늘려 잡는다. 안 그러면 무지에서 8장까지
  // 되던 것이 양면에서 4장으로 조용히 줄어든다.
  bothTwo: [
    { key:'B', ko:'베개커버', qty:2, many:true,
      faces:[{ part:'bothA', face:'앞면' }, { part:'bothB', face:'뒷면' }] },
  ],
  bothPlain: [
    { key:'B', ko:'베개커버', qty:2, many:true, faces:[{ part:'bothA' }] },
  ],
};
// 사이즈·장수 칸은 한 벌만 만들어두고 감췄다 보였다 한다.
// 그래야 양면/무지를 오가도 적어둔 사이즈와 장수가 살아남는다.
const PIL_UNION = [];
for (const list of Object.values(PIL_MODES))
  for (const s of list) if (!PIL_UNION.some(u => u.key === s.key)) PIL_UNION.push(s);
// 한 모드 안의 칸들은 **같은 디자인의 부위**만 가리켜야 한다. 섞이면 그 디자인에서
// 감춰진 부위의 색이 주문서에 딸려 나간다.
for (const [mode, list] of Object.entries(PIL_MODES)) {
  const used = [];
  for (const s of list) for (const f of s.faces) {
    const p = PARTS.find(p => p.key === f.part);
    if (!p) throw new Error(`베개 칸 ${s.ko} 가 없는 부위 ${f.part} 를 가리킵니다`);
    used.push(p);
  }
  const ok = DESIGNS.some(d => used.every(p => inDz(p, d.key)));
  if (!ok) throw new Error(`PIL_MODES.${mode} 의 부위들이 한 디자인 안에 모여 있지 않습니다`);
}

// 이불 = 완제품 크기 / 매트리스커버 = 침대 규격. 체계가 다르다 [대표, 2026-08-04]
// 견적을 내려면 모든 선택지가 가격을 가져야 하므로 "잘 모르겠습니다" 류는 두지 않는다 [대표]
const MAT = ['싱글 100×200','슈퍼싱글 110×200','120×200','퀸 150×200','160×200','170×200',
  '180×200','190×200','200×200','220×200'];
const OZ = ['여름용 (4온스)','초여름·간절기용 (6온스)','간절기용 (8온스)','한겨울용 (10온스)'];
// 이불·매트리스커버는 종류를 먼저 고른다. 가격표도 사이즈 목록도 종류마다 따로다.
// [대표, 2026-08-05]
//   sizes — 이 종류에서 고를 수 있는 사이즈. 종류를 바꾸면 사이즈 칸이 다시 채워진다.
//           차렵이불 슈퍼싱글은 150×210, 이불커버 슈퍼싱글은 160×210 으로 다르다.
//           같은 「슈퍼싱글」이라도 값이 달라 한 목록으로 묶으면 틀린 치수가 주문에 나간다.
//   oz    — 두께(온스) 칸을 보일지. 이불커버는 솜이 없어 온스가 없다.
//   snap  — 이불 연결 똑딱이 갯수 칸을 보일지. 이불커버에만 있다.
const QUILT_KIND = [
  { key:'charyeop', ko:'차렵이불', oz:true, snap:false,
    sizes:['슈퍼싱글 150×210','퀸 200×230','킹 220×240','라지킹 240×240'] },
  { key:'cover',    ko:'이불커버', oz:false, snap:true,
    sizes:['슈퍼싱글 160×210','퀸 200×230','킹 220×240','라지킹 240×240'] },
];
// 이름이 길어 견적에는 short 를 쓴다. 주문서에는 ko 를 그대로 쓴다.
const MAT_KIND = [
  { key:'allinone', ko:'올인원(누빔) 매트리스커버', short:'올인원(누빔)', sizes:MAT },
  { key:'plain',    ko:'홑겹 매트리스커버',        short:'홑겹',        sizes:MAT },
];
// 종류를 바꿔도 고르던 사이즈가 그 종류에 있으면 유지하고, 없으면 이 값으로 돌아간다.
const DEF_SIZE = { quilt:'퀸 200×230', mattress:'퀸 150×200' };
// 사이즈·수량 모두 4칸에서 각각 받는다. 40×60과 50×70을 섞어 쓰는 집이 있고,
// 수량을 따로 받으면 "4색을 골랐는데 2장" 처럼 어느 색인지 알 수 없어진다 [대표, 2026-08-04]
// 「그 외」 선택지를 뺐다 [대표, 2026-08-05]. 사이즈가 정해지지 않아 값을 못 내는 칸이라
// 그 줄만 「가격 문의」로 빠졌는데, 결제를 붙이면 결제가 안 되는 주문이 된다.
// 이제 모든 베개 사이즈에 값이 있다. 다른 사이즈는 「남기실 말」로 받는다.
const PILLOW = ['40×60','50×70'];
const PIL_QTY = [0,1,2,3,4];
// 칸이 하나뿐인 모드(양면)용. 네 칸 몫을 한 칸에서 받는다.
const PIL_QTY_MANY = [0,1,2,3,4,5,6,7,8];
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
  quilt: {                 // 종류별 정상가. 칸 이름은 QUILT_KIND 의 key 다.
    sale: {
      charyeop: {          // 차렵이불 [대표, 2026-08-04]
        '슈퍼싱글 150×210': 195000,
        '퀸 200×230':       265000,
        '킹 220×240':       290000,
        '라지킹 240×240':   340000,
      },
      cover: {             // 이불커버 [대표, 2026-08-05]. 슈퍼싱글이 차렵이불과 치수가 다르다
        '슈퍼싱글 160×210': 170000,
        '퀸 200×230':       190000,
        '킹 220×240':       210000,
        '라지킹 240×240':   240000,
      },
    },
    custom: 10000,         // 이불 맞춤 추가금 (1장당). 사이즈·종류 무관 [대표, 2026-08-04]
  },
  mattress: {              // 종류별 정상가. 칸 이름은 MAT_KIND 의 key 다.
    sale: {
      // 종류를 나누기 전부터 있던 값이 올인원(누빔) 가격이 맞다 [대표, 2026-08-05]
      allinone: {          // 올인원(누빔) 매트리스커버. 기준가 14만원 [대표, 2026-08-04]
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
      plain: {             // 홑겹 매트리스커버 [대표, 2026-08-05]
        '싱글 100×200':     110000,
        '슈퍼싱글 110×200': 110000,
        '120×200':          110000,
        '퀸 150×200':       120000,
        '160×200':          135000,
        '170×200':          145000,
        '180×200':          155000,
        '190×200':          170000,
        '200×200':          180000,
        '220×200':          195000,
      },
    },
    custom: 10000,         // 매트리스커버 맞춤 추가금 (1장당). 사이즈·종류 무관 [대표, 2026-08-04]
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
    sale: {
      '40×60': 28000,
      '50×70': 28000,
    },
    // 베개커버에는 맞춤 추가금이 없다 [대표, 2026-08-06].
    //   2026-08-04 에 26,000 + 3,000 으로 받아 적었는데 잘못이었다. 한 장 28,000 이고
    //   맞춤 추가금은 원래 없다 — 대표가 2장 56,000 을 짚어 주면서 드러났다.
    //   0 을 null 로 두면 「가격 문의」로 새어나간다. 반드시 0 이어야 한다.
    custom: 0,
    // 양면 베개커버 추가금 — **장수로 붙는다.** 2장까지 10,000원 [대표, 2026-08-06].
    // 천이 두 종류라 무지와 값이 같을 수 없다. 이불 양면은 값이 같지만 베개는 다르다.
    two: { per: 2, add: 10000 },
  },
};

// 이 페이지로 들어오는 주문은 색 조합을 직접 고른 것이라 전부 맞춤 제작이다.
// 그래서 맞춤 추가금은 항상 붙는다. 기성가로만 낼 일이 생기면 false 로 바꾼다.
const ALWAYS_CUSTOM = true;

// 사이즈 목록과 가격표가 어긋나면 조용히 "문의"로 새어나가므로 여기서 잡는다.
// 종류가 있는 항목은 종류마다 가격표가 하나씩 있어야 한다. 한 종류만 채우고 넘어가면
// 나머지 종류가 통째로 「가격 문의」로 새어나간다.
// 사이즈 목록은 종류마다 다르므로 종류별 목록으로 대조한다.
for (const [group, list, kinds] of [['quilt', null, QUILT_KIND], ['mattress', null, MAT_KIND],
                                    ['pillow', PILLOW, null]]) {
  const tables = kinds
    ? kinds.map(k => [`${group}.sale.${k.key} (${k.ko})`, PRICE[group].sale[k.key], k.sizes])
    : [[`${group}.sale`, PRICE[group].sale, list]];
  for (const [name, table, list] of tables) {
    if (!table) throw new Error(`PRICE.${name} 칸이 없습니다`);
    const miss = list.filter(s => !(s in table));
    const extra = Object.keys(table).filter(s => !list.includes(s));
    if (miss.length || extra.length)
      throw new Error(`PRICE.${name} 이 사이즈 목록과 다릅니다`
        + (miss.length  ? `\n  가격표에 없는 사이즈: ${miss.join(', ')}` : '')
        + (extra.length ? `\n  목록에 없는 가격 항목: ${extra.join(', ')}` : ''));
  }
}

// 양면 베개커버 추가금 — per 가 0이나 음수면 나누기에서 무한대가 나와 값이 폭주한다.
{
  const t = PRICE.pillow.two;
  if (t && (!(t.per >= 1) || !(t.add >= 0)))
    throw new Error('PRICE.pillow.two 는 per 가 1 이상, add 가 0 이상이어야 합니다');
}
// 손님이 체크칸에서 미리 알 수 있게 문구를 표에서 만든다. 손으로 적으면 값만 고쳤을 때 어긋난다.
const PIL_TWO_TEXT = PRICE.pillow.two && PRICE.pillow.two.add
  ? `${PRICE.pillow.two.per}장까지 ${PRICE.pillow.two.add.toLocaleString('ko-KR')}원이 더 붙습니다.` : '';

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

 /* 디자인 고르기 — 쇼핑몰 상품 목록처럼 사진 카드를 눌러 들어간다 [대표, 2026-08-06].
    카드 두 장은 같은 사진·같은 색이고 젖혀진 면만 다르다. 견주면 차이가 그것 하나로 보인다. */
 .cards{display:grid;grid-template-columns:1fr 1fr;gap:11px}
 .cards button{display:block;width:100%;padding:0;overflow:hidden;cursor:pointer;font-family:inherit;
  text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg)}
 .cards button img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
 .cards .ct{display:block;padding:10px 11px 12px;position:relative}
 .cards .cn{display:block;font-size:14px;font-weight:650;line-height:1.4}
 .cards .cd{display:block;font-size:11.5px;color:var(--mut);line-height:1.45}
 .cards button[aria-pressed="true"]{border-color:var(--fg);box-shadow:0 0 0 1.5px var(--fg)}
 .cards .cnow{display:none;font-size:10.5px;font-weight:650;color:var(--bg);background:var(--fg);
  border-radius:999px;padding:2px 8px;margin-top:5px;width:fit-content}
 .cards button[aria-pressed="true"] .cnow{display:block}
 .chint{font-size:11.5px;color:var(--mut);margin:12px 0 0;line-height:1.7}

 /* ② 색 화면 맨 위 — 지금 어느 디자인인지 보이고, 한 번에 바꿔 돌아갈 수 있다 */
 .dnow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;
  padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--card);font-size:12.5px}
 .dnow b{font-weight:650}
 .dnow span{color:var(--mut)}
 .dnow button{flex:none;border:1px solid var(--line);background:var(--bg);color:var(--fg);
  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit}

 /* 미리보기 — 디자인마다 사진이 달라 한 벌씩 만들어두고 고른 것만 보인다.
    사진 비율도 다르다(무지 4:5, 양면 3:4). 자리를 미리 잡아두면 바꿀 때 화면이 튄다. */
 .scenebox{margin-bottom:14px}
 .scene{position:relative;border-radius:11px;overflow:hidden;background:#fff;isolation:isolate;
  box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 20px rgba(0,0,0,.07)}
 .scene[hidden]{display:none}
 .scene img{display:block;width:100%;height:auto}
 .layer{position:absolute;inset:0;mix-blend-mode:multiply;pointer-events:none;
  -webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-mode:alpha;mask-mode:alpha;transition:background-color .18s}
 .scenebox.mini{max-width:190px;margin:0 auto 16px}

 .step{display:none}
 .step[aria-hidden="false"]{display:block}

 /* 베개커버를 양면으로 할지 — 이불이 양면이어도 베개는 따로 받는다 */
 .ptwo{display:flex;align-items:flex-start;gap:9px;margin:0 0 11px;padding:10px 12px;
  border:1px solid var(--line);border-radius:9px;background:var(--card);
  font-size:11.5px;color:var(--mut);line-height:1.55;cursor:pointer}
 .ptwo[hidden]{display:none}
 .ptwo input{width:18px;height:18px;accent-color:var(--fg);flex:none;margin-top:1px}
 .ptwo b{color:var(--fg);font-size:12.5px;font-weight:650}

 /* 부위 · 팔레트 */
 .parts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
 .part{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--fg);
  border-radius:999px;padding:7px 13px 7px 8px;font-size:13px;cursor:pointer;font-family:inherit}
 .part[aria-pressed="true"]{border-color:var(--fg);background:var(--fg);color:var(--bg);font-weight:600}
 /* display 를 따로 준 요소는 hidden 속성만으로 안 감춰진다 */
 .part[hidden]{display:none}
 .dot{width:17px;height:17px;border-radius:50%;border:1px solid rgba(0,0,0,.18);flex:none}
 .now{display:flex;align-items:center;gap:11px;padding:11px 12px;border:1px solid var(--line);
  border-radius:9px;margin-bottom:6px;background:var(--card)}
 .now .big{width:34px;height:34px;border-radius:7px;border:1px solid rgba(0,0,0,.14);flex:none}
 .now .l1{font-size:13.5px;font-weight:600}
 .now .l2{font-size:11.5px;color:var(--mut)}
 .hint{font-size:11.5px;color:var(--mut);margin:0 0 12px}
 .gname{font-size:11px;color:var(--mut);margin:14px 0 7px}
 /* 칩 밑에 번수(위)와 원단 번호(아래)를 적는다. 컬러명은 넣지 않는다 —
    한글명이 「라이트 스킨 베이지」처럼 길어 이 폭에서는 잘려서 오히려 못 읽는다.
    이름은 칩을 누르면 위쪽 큰 칸에 나오고, 마우스를 올려도 나온다. [대표, 2026-08-05] */
 .sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:10px 7px}
 .sw button{border:0;background:none;padding:0;cursor:pointer;font-family:inherit;
  display:flex;flex-direction:column;gap:3px;text-align:center}
 .sw button .c{display:block;aspect-ratio:1;border-radius:8px;border:1px solid rgba(0,0,0,.12)}
 .sw button .n{font-size:10px;line-height:1.15;color:var(--fg);letter-spacing:-.3px}
 /* 번수는 매트리스커버에서 고를 수 있는지를 가르는 값이라 흐리면 안 된다 [대표, 2026-08-05] */
 .sw button .s{font-size:10px;line-height:1.15;color:var(--fg);font-weight:600}
 .sw button[aria-current="true"] .c{box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--fg)}
 .sw button[aria-current="true"] .n{font-weight:700}

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
 /* 가로·세로·높이 세 칸. 폰(375px)에서 한 칸이 100px 남짓이라 안내글은 짧게 쓴다 */
 .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}
 .three .fld input{padding:11px 8px;text-align:center}
 .skip{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut);margin-top:10px;cursor:pointer}
 .skip input{width:17px;height:17px;accent-color:var(--fg)}
 .off{opacity:.4;pointer-events:none}
 .warn{font-size:12px;color:var(--bad);font-weight:600;margin:2px 0 0;line-height:1.55}
 .warn[hidden]{display:none}
 .fld input.bad,.fld select.bad{border-color:var(--bad);outline:1px solid var(--bad);outline-offset:-2px}

 /* 베개 칸 — 칸마다 색·사이즈·장수. 양면은 한 칸에 색이 둘(앞면·뒷면)이다 */
 .prow{display:block;padding:11px 0;border-top:1px solid var(--line)}
 /* 맨 위 칸에는 줄을 긋지 않는다. 감춘 칸이 앞에 있을 수 있어 :first-child 로는 안 된다 —
    renderPillows() 가 보이는 첫 칸에 .first 를 붙인다. */
 .prow.first{border-top:0;padding-top:2px}
 .prow[hidden]{display:none}
 .prow .pnm{font-size:13px;font-weight:600;line-height:1.35}
 .prow .pcls{margin-bottom:7px}
 .prow .pcl{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--mut);line-height:1.5;margin-top:3px}
 .prow .pdot{width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,.16);flex:none}
 .prow .pfc{flex:none;color:var(--fg);font-weight:600}
 .psel{display:flex;gap:7px}
 .psel select{padding:9px 8px;border-radius:8px;border:1px solid var(--line);
  background:var(--bg);color:var(--fg);font-size:13.5px;font-family:inherit;min-width:0}
 .psel select:focus{outline:2px solid var(--fg);outline-offset:-1px}
 .psel .ps{flex:1}
 .psel .pq{flex:0 0 76px}
 .prow.zero .pnm,.prow.zero .pcls,.prow.zero .ps{opacity:.4}
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
  <p class="sub" id="sub"></p>
</header>

<div class="steps">
  <div data-s="0" aria-current="true">① 디자인</div>
  <div data-s="1">② 색</div>
  <div data-s="2">③ 사이즈</div>
  <div data-s="3">④ 확인</div>
</div>

<!-- ① 디자인 -->
<section class="step" data-step="0" aria-hidden="false">
  <div class="cards" id="designs">
${DESIGNS.map((d,i)=>`    <button data-design="${d.key}" aria-pressed="${i===0}">
      <img src="${b64(d.card,'image/jpeg')}" alt="${d.ko} 미리보기">
      <span class="ct"><span class="cn">${d.ko}</span><span class="cd">${d.d}</span><span class="cnow">고르신 것</span></span>
    </button>`).join('\n')}
  </div>
  <p class="chint">사진의 색은 예시입니다. 다음 단계에서 원단 ${total}색 중에서 고르시면 됩니다.<br>
    <b>디자인을 바꿔도 고르신 색은 그대로 둡니다</b> — 언제든 돌아와 바꿔보실 수 있습니다.</p>
</section>

<!-- ② 색 -->
<section class="step" data-step="1" aria-hidden="true">
  <div class="dnow">
    <span><b id="dnowT"></b> · <span id="dnowD"></span></span>
    <button type="button" id="dchg">디자인 바꾸기</button>
  </div>
  <div class="scenebox" id="sceneMain">
${DESIGNS.map(d=>`    <div class="scene" data-design="${d.key}"${d.key===DESIGNS[0].key?'':' hidden'}>
      <img src="${b64(d.base,'image/jpeg')}" alt="${d.ko} 미리보기">
${PARTS.filter(p=>inDz(p,d.key)).map(p=>{const u=b64(`mask_${p.key}.png`,'image/png');return `      <div class="layer" data-part="${p.key}" style="background-color:${p.def};-webkit-mask-image:url('${u}');mask-image:url('${u}')"></div>`;}).join('\n')}
    </div>`).join('\n')}
  </div>
  <label class="ptwo" id="pTwoWrap" hidden>
    <input type="checkbox" id="p_two" checked>
    <span><b>베개커버도 앞뒤를 다르게</b>${PIL_TWO_TEXT ? ` <b>${PIL_TWO_TEXT}</b>` : ''}<br>
      사진처럼 베개 <b>한 장의 앞뒤</b>를 다른 색으로 만듭니다.
      체크를 푸시면 베개는 <b>앞면 색 한 가지</b>로 나가고 추가금도 없습니다.</span>
  </label>
  <div class="parts">
${PARTS.filter(pickable).map(p=>`    <button class="part" data-part="${p.key}" aria-pressed="false"><span class="dot" style="background:${p.def}"></span>${p.ko}</button>`).join('\n')}
  </div>
  <div class="now">
    <span class="big" id="nowSw"></span>
    <span><span class="l1" id="nowL1">-</span><br><span class="l2" id="nowL2">-</span></span>
  </div>
  <p class="hint" id="palHint"></p>
  <div id="palette"></div>
</section>

<!-- ③ 사이즈 -->
<section class="step" data-step="2" aria-hidden="true">
  <div class="card">
    <h2>이불</h2>
    <p class="d"><b>차렵이불</b>은 솜이 들어 있는 일체형입니다.
      <b>이불커버</b>는 커버만이라 두께(온스)를 고르지 않습니다.</p>
    <div id="grpQuilt">
      <div class="fld"><label>종류</label><select id="q_kind">${QUILT_KIND.map((k,i)=>`<option value="${k.key}"${i===0?' selected':''}>${k.ko}</option>`).join('')}</select></div>
      <div class="fld"><label>사이즈</label><select id="q_size"></select></div>
      <div class="fld" id="q_ozFld"><label>두께</label><select id="q_oz">${OZ.map(o=>`<option${o==='간절기용 (8온스)'?' selected':''}>${o}</option>`).join('')}</select></div>
      <div class="fld" id="q_snapFld"><label>이불 연결 똑딱이 갯수</label>
        <input id="q_snap" type="text" inputmode="numeric" placeholder="예: 8"></div>
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
      <div class="fld"><label>종류</label><select id="m_kind">${MAT_KIND.map((k,i)=>`<option value="${k.key}"${i===0?' selected':''}>${k.ko}</option>`).join('')}</select></div>
      <div class="fld"><label>침대 규격 (값의 기준)</label><select id="m_size"></select></div>
      <!-- 가로·세로를 한 칸에 「150x200」으로 받았더니 폰에서 못 적었다. 숫자 자판에는
           x 가 없다 [대표, 2026-08-06]. 칸을 나누면 숫자 자판 그대로 쓰면서 x 가 필요 없다. -->
      <div class="three">
        <div class="fld"><label>가로 (cm)</label><input id="m_w" type="text" inputmode="numeric" placeholder="150"></div>
        <div class="fld"><label>세로 (cm)</label><input id="m_d" type="text" inputmode="numeric" placeholder="200"></div>
        <div class="fld"><label>높이 (cm)</label><input id="m_h" type="text" inputmode="numeric" placeholder="30"></div>
      </div>
      <p class="warn" id="m_hWarn" hidden></p>
      <div class="fld"><label>수량</label><select id="m_qty">${ITEM_QTY.map(n=>`<option value="${n}">${n}장</option>`).join('')}</select></div>
    </div>
    <label class="skip"><input type="checkbox" id="m_skip"> 매트리스커버는 안 할래요</label>
  </div>

  <div class="card">
    <h2>베개커버</h2>
    <p class="d" id="pDesc"></p>
    <div id="grpPil">
${PIL_UNION.map(s=>`      <div class="prow" data-slot="${s.key}">
        <div class="pnm"></div>
        <div class="pcls"></div>
        <div class="psel">
          <select class="ps" data-slot="${s.key}">${PILLOW.map(o=>`<option${o==='50×70'?' selected':''}>${o}</option>`).join('')}</select>
          <select class="pq" data-slot="${s.key}">${(s.many?PIL_QTY_MANY:PIL_QTY).map(n=>`<option value="${n}"${n===s.qty?' selected':''}>${n}장</option>`).join('')}</select>
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

<!-- ④ 확인 -->
<section class="step" data-step="3" aria-hidden="true">
  <div class="scenebox mini" id="sceneMini"></div>
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
  <button class="next" id="btnNext"></button>
</div>

<script>
const SW = ${JSON.stringify(SW)};
const PARTS = ${JSON.stringify(PARTS)};
const DESIGNS = ${JSON.stringify(DESIGNS)};
const CARRY = ${JSON.stringify(CARRY)};
const PIL_MODES = ${JSON.stringify(PIL_MODES)};
const TOTAL = ${total};
const PRICE = ${JSON.stringify(PRICE)};
const ALWAYS_CUSTOM = ${ALWAYS_CUSTOM};
const QUILT_KIND = ${JSON.stringify(QUILT_KIND)};
const MAT_KIND = ${JSON.stringify(MAT_KIND)};
const DEF_SIZE = ${JSON.stringify(DEF_SIZE)};
const PRICE_READY = ${PRICE_READY};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const byHex = {};
for (const g of Object.values(SW)) for (const c of g.colors) if(!byHex[c.hex]) byHex[c.hex] = c;
const state = {};
PARTS.forEach(p => state[p.key] = byHex[p.def] || { no:'', en:'', ko:'직접 지정', su:'', hex:p.def });
const inDz = (p, d) => !p.dz || p.dz.includes(d);
const pickable = p => !p.follow;
let design = DESIGNS[0].key, step = 0;
// parts() = 지금 디자인에서 **손님이 고르는** 부위. 삥처럼 따라가는 자리는 뺀다.
const parts = () => PARTS.filter(p => inDz(p, design) && pickable(p));
// 실제로 칠할 색. 따라가는 자리는 주인 색을 쓴다.
const paintOf = p => state[p.follow || p.key].hex;
let cur = parts()[0];

/* ---- 단계 이동 ---- */
const NEXT_LABEL = ['색 고르기','사이즈 입력하기','확인하기','복사하기'];
const LAST = NEXT_LABEL.length - 1;
function goto(s){
  step = s;
  $$('.step').forEach(el => el.setAttribute('aria-hidden', +el.dataset.step !== s));
  $$('.steps div').forEach(el => el.setAttribute('aria-current', +el.dataset.s === s));
  $('#btnPrev').hidden = s === 0;
  $('#btnNext').textContent = NEXT_LABEL[s];
  if (s === 2) { renderPillows(); checkHeight(); }
  if (s === 3) { buildMini(); renderQuote(); renderOrder(); }
  renderSub();
  window.scrollTo({ top:0, behavior:'instant' });
}
/* ---- 뒤로가기 ----
   단계를 브라우저 기록에 남긴다. 안 남기면 폰에서 뒤로가기를 눌렀을 때 **페이지를 통째로 벗어나
   고르던 것이 전부 날아간다** [대표, 2026-08-06]. 양면을 보다가 무지로 돌아가려고 뒤로가기를
   누르는 것이 자연스러운데, 그때 딴 데로 가버렸다.
   goto 는 화면만 바꾸고 기록은 건드리지 않는다. 손님이 눌러서 옮길 때만 navigate 로 기록을 남긴다 —
   뒤로가기로 돌아온 것까지 기록에 더하면 뒤로가기가 영영 안 끝난다. */
function navigate(s){
  if (s === step) return;
  goto(s);
  try { history.pushState({ step:s }, ''); } catch(_) {}   // file:// 에서 막히면 그냥 넘어간다
}
addEventListener('popstate', e => goto(e.state && typeof e.state.step === 'number' ? e.state.step : 0));

$('#btnPrev').onclick = () => navigate(Math.max(0, step-1));
$('#btnNext').onclick = async () => {
  if (step < LAST) return navigate(step+1);
  const t = $('#orderTxt').textContent;
  try { await navigator.clipboard.writeText(t); }
  catch(_) { const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  const b = $('#btnNext'); b.textContent='복사했습니다'; setTimeout(()=>b.textContent='복사하기',1500);
};

/* ---- 색 ---- */
const layers = {}, dots = {}, btns = {};
$$('#sceneMain .layer').forEach(l => layers[l.dataset.part] = l);
$$('.part').forEach(b => {
  btns[b.dataset.part] = b;
  dots[b.dataset.part] = b.querySelector('.dot');
  b.onclick = () => pick(PARTS.find(p => p.key === b.dataset.part));
});
function pick(p){
  cur = p;
  // 따라가는 자리(삥)는 단추가 없다. 전부 훑으면 없는 단추를 건드려 넘어진다.
  PARTS.filter(pickable).forEach(q => btns[q.key].setAttribute('aria-pressed', q.key === p.key));
  renderColor();
}

/* ---- 디자인 ----
   무지와 양면은 사진이 같고 이불 마스크만 다르다. 층과 단추를 감췄다 보였다 할 뿐이다.
   고른 색은 그대로 둔다 — 디자인만 바꿔 견주는 것이 이 탭의 요점이다. */
const touched = {};   // 손님이 실제로 눌러서 고른 부위. apply() 에서 표시한다.
function syncDesign(){
  // 사진은 디자인마다 한 장씩 있고 고른 것만 보인다. 층은 그 사진 안에만 있다.
  $$('#sceneMain .scene').forEach(s => s.hidden = s.dataset.design !== design);
  PARTS.forEach(p => {
    layers[p.key].style.backgroundColor = paintOf(p);
    if (pickable(p)) {
      btns[p.key].hidden = !inDz(p, design);
      dots[p.key].style.background = state[p.key].hex;
    }
  });
  $('#pTwoWrap').hidden = !DESIGNS.find(d => d.key === design).pilTwo;
  renderPillows();
  $$('#designs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.design === design));
  const d = DESIGNS.find(x => x.key === design);
  $('#dnowT').textContent = d.ko;
  $('#dnowD').textContent = d.d;
  // 확인 화면의 작은 미리보기는 이 화면을 복사해 만든다. 디자인이 바뀌면 다시 만들어야 한다.
  $('#sceneMini').dataset.built = '';
  if (!inDz(cur, design)) pick(parts()[0]);
  else pick(cur);
}
function setDesign(key){
  if (key === design) return;
  design = key;
  // 아직 **손 안 댄** 부위에만 쓰던 색을 물려준다.
  //   물려주지 않으면 — 양면에서 색을 고르고 무지로 가면 흰색부터 다시 골라야 한다.
  //   늘 물려주면 — 무지를 들렀다 오는 사이에 양면에서 고른 뒷면 색이 앞면 색으로 덮인다.
  for (const [to, from] of Object.entries(CARRY[key] || {}))
    if (!touched[to]) state[to] = state[from];
  syncDesign();
}
// 카드를 누르면 그 디자인으로 **들어간다** — 고른 뒤 다시 「다음」을 누르게 하지 않는다.
$$('#designs button').forEach(b => b.onclick = () => { setDesign(b.dataset.design); navigate(1); });
$('#dchg').onclick = () => navigate(0);
// 화면마다 할 말이 다르다. 색 화면에서는 처음에 전부 흰색이라 그 말을 해주는데,
// 색을 하나라도 바꾸면 더는 사실이 아니므로 말을 바꾼다.
function renderSub(){
  if (step === 0) return $('#sub').textContent = '디자인을 고르시면 색을 고르는 화면으로 넘어갑니다.';
  const ps = parts(), white = ps.every(p => state[p.key].hex === p.def);
  $('#sub').textContent = white
    ? \`지금은 \${ps.length}곳 모두 흰색입니다. 부위를 눌러 원단 \${TOTAL}색 중에서 바꿔보세요.\`
    : \`부위 \${ps.length}곳을 원단 \${TOTAL}색에서 고릅니다.\`;
}
function label(c){ return c.no ? \`NO. \${c.no} · \${c.ko} \${c.su}수\` : c.ko; }
function apply(c){
  state[cur.key] = c;
  touched[cur.key] = 1;
  layers[cur.key].style.backgroundColor = c.hex;
  dots[cur.key].style.background = c.hex;
  // 이 부위를 따라가는 자리(삥)도 같이 칠한다. 안 하면 앞면만 바뀌고 테두리가 흰 채로 남는다.
  PARTS.forEach(p => { if (p.follow === cur.key) layers[p.key].style.backgroundColor = c.hex; });
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
  renderSub();
}
const pal = $('#palette');
for (const g of Object.values(SW)) {
  const t = document.createElement('div'); t.className='gname'; t.textContent = g.ko + '  ' + g.en; pal.appendChild(t);
  const row = document.createElement('div'); row.className='sw';
  g.colors.forEach(c => {
    const b = document.createElement('button');
    b.dataset.k = c.k; b.dataset.su = c.su;
    b.title = 'NO. ' + c.no + ' ' + c.ko + ' ' + c.su + '수';
    // 읽어주는 기계에는 색만 보여줄 수 없으니 이름까지 말해준다.
    b.setAttribute('aria-label', c.ko + ' ' + c.su + '수, 번호 ' + c.no);
    const sw = document.createElement('span'); sw.className = 'c'; sw.style.background = c.hex;
    const no = document.createElement('span'); no.className = 'n'; no.textContent = c.no;
    const su = document.createElement('span'); su.className = 's'; su.textContent = c.su + '수';
    b.append(sw, su, no);   // 번수가 위, 원단 번호가 아래 [대표, 2026-08-05]
    b.onclick = () => apply(c); row.appendChild(b);
  });
  pal.appendChild(row);
}

/* ---- 베개커버 ----
   ②에서 고른 색이 곧 주문하실 베개커버다. 칸 수는 디자인마다 다르다 —
   무지는 네 칸, 양면은 두 칸이고 한 칸이 앞면·뒷면 두 색을 갖는다. */
// 이불이 양면이어도 베개커버까지 양면인 것은 아니다. 체크를 풀면 앞면 색 한 가지로 나간다.
const canTwo  = () => !!DESIGNS.find(d => d.key === design).pilTwo;
const pilTwo  = () => canTwo() && $('#p_two').checked;
const slots   = () => PIL_MODES[canTwo() ? (pilTwo() ? 'bothTwo' : 'bothPlain') : 'single'];
const pq = k => +$('.pq[data-slot="' + k + '"]').value;
const ps = k => $('.ps[data-slot="' + k + '"]').value;
const pillowCount = () => slots().reduce((s, sl) => s + pq(sl.key), 0);
const pillowRows = () => slots().map(sl => ({ sl, size:ps(sl.key), n:pq(sl.key) })).filter(r => r.n > 0);
// 사이즈마다 값이 다르니 사이즈별로 묶어서 센다. 순서는 화면에 나온 순서 그대로.
function pillowBySize(){
  const g = new Map();
  pillowRows().forEach(r => g.set(r.size, (g.get(r.size) || 0) + r.n));
  return [...g];
}
function renderPillows(){
  // 칸이 하나뿐인 모드(양면)는 말투가 달라진다 — 「칸마다」가 성립하지 않고,
  // 칸 이름이 바로 위 제목과 같은 말이 된다.
  const one = slots().length === 1;
  const on = new Set(slots().map(s => s.key));
  // 이 디자인에 없는 칸은 감춘다. 지우지 않는 것은 디자인을 되돌렸을 때
  // 적어둔 사이즈와 장수가 그대로 살아 있게 하기 위해서다.
  $$('.prow').forEach(r => r.hidden = !on.has(r.dataset.slot));
  const first = $$('.prow').find(r => !r.hidden);
  $$('.prow').forEach(r => r.classList.toggle('first', r === first));
  slots().forEach(sl => {
    const row = $('.prow[data-slot="' + sl.key + '"]');
    const nm = row.querySelector('.pnm');
    nm.textContent = sl.ko;
    nm.hidden = one;            // 칸이 하나면 바로 위 제목과 같은 말이 두 번 나온다
    const box = row.querySelector('.pcls');
    box.textContent = '';
    sl.faces.forEach(f => {
      const c = state[f.part];
      const line = document.createElement('div'); line.className = 'pcl';
      const dot = document.createElement('span'); dot.className = 'pdot'; dot.style.background = c.hex;
      line.append(dot);
      if (f.face) { const t = document.createElement('b'); t.className = 'pfc'; t.textContent = f.face; line.append(t); }
      const nm = document.createElement('span'); nm.textContent = label(c); line.append(nm);
      box.append(line);
    });
    row.querySelector('.ps').setAttribute('aria-label', sl.ko + ' 사이즈');
    row.querySelector('.pq').setAttribute('aria-label', sl.ko + ' 장수');
    row.classList.toggle('zero', pq(sl.key) === 0);
  });
  $('#pDesc').innerHTML = (one
      ? '베개커버는 <b>모두 같은 색</b>입니다 — 이불과 한 몸이라 한 장씩 다르게는 못 합니다.'
      : '②에서 고르신 <b>' + slots().length + '칸이 곧 주문하실 베개커버</b>입니다.')
    + (pilTwo() ? ' <b>양면 베개커버</b>라 한 장이 앞면·뒷면 두 색입니다.' : '')
    // 양면 사진은 베개가 늘 앞뒤 두 색으로 보인다. 무지로 고르셨으면 그 말을 해줘야 한다.
    + (canTwo() && !pilTwo() ? ' 사진에는 베개 앞뒤가 다르게 보이지만,'
        + ' <b>무지로 고르셔서 앞면 색 한 가지</b>로 나갑니다.' : '')
    + (one ? ' <b>사이즈와 장수</b>만 골라주세요 — 안 사실 거면 <b>0장</b>.'
           : ' 칸마다 사이즈와 장수를 골라주세요 — 안 사실 칸은 <b>0장</b>.')
    + '<br>사이즈는 쓰시는 베개 기준입니다. 베개 사신 곳에 나와 있는 숫자면 됩니다. '
    + '<b>목록에 없는 사이즈</b>' + (one ? '나 <b>사이즈를 섞어</b> 쓰실 때' : '')
    + '는 아래 <b>남기실 말</b>에 적어주세요 — 따로 안내드립니다.';
  const n = pillowCount();
  $('#pTot').textContent = !n ? '전부 0장 — 베개커버는 주문하지 않는 것으로 봅니다'
    : one ? '모두 ' + n + '장'   // 칸이 하나면 사이즈별 내역이 바로 위 줄과 같은 말이다
    : '모두 ' + n + '장  ·  ' + pillowBySize().map(([s, c]) => s + ' ' + c + '장').join(', ');
}
$$('.pq, .ps').forEach(s => s.onchange = renderPillows);
// 베개 양면 여부가 바뀌면 부위 이름·미리보기·칸 수가 한꺼번에 따라간다.
$('#p_two').onchange = () => { syncDesign(); };

/* ---- 매트리스 높이: 받을 수 있는 최대 높이를 넘으면 그 자리에서 알린다 ---- */
const HT_ALL = PRICE.mattress.height || [];
const H_MAX = HT_ALL.length ? HT_ALL[HT_ALL.length - 1].upto : null;
// 적힌 치수를 읽는다. 비었거나 숫자가 아니거나 0 이하면 null.
// 「안 적음」과 「못 읽는 값」을 가려야 「적어주세요」와 「숫자로 적어주세요」를 나눠 낼 수 있다.
const dimTyped = id => $('#' + id).value.trim() !== '';
function dim(id){
  const raw = $('#' + id).value.trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
// 가로·세로는 **둘 다** 있어야 치수가 된다. 하나만 적힌 것은 치수가 아니다.
const matWH = () => { const w = dim('m_w'), d = dim('m_d'); return w && d ? w + '×' + d : ''; };
const matWHJunk = () => ['m_w','m_d'].some(id => dimTyped(id) && dim(id) == null);
const height = () => dim('m_h');
const heightTyped = () => dimTyped('m_h');
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

/* ---- 종류 ---- */
const designKo   = () => DESIGNS.find(d => d.key === design).ko;
const quiltParts = () => parts().filter(p => p.grp === 'quilt');
// 매트리스커버 부위는 디자인마다 키가 다르다 (무지 mattress / 양면 bothM).
// 키를 박아두면 디자인을 바꿨을 때 엉뚱한 색이 주문서에 나간다.
const matColor   = () => state[parts().find(p => p.grp === 'mat').key];
const quiltKind  = () => QUILT_KIND.find(k => k.key === $('#q_kind').value);
const matKind   = () => MAT_KIND.find(k => k.key === $('#m_kind').value);
// 사이즈 목록이 종류마다 다르므로 종류를 바꾸면 다시 채운다.
// 고르던 사이즈가 새 종류에도 있으면 그대로 두고, 없으면 기본값으로 돌아간다.
// (차렵이불 「슈퍼싱글 150×210」 → 이불커버에는 없으므로 퀸으로 돌아간다)
function fillSizes(sel, sizes, def){
  const keep = sizes.includes(sel.value) ? sel.value
             : sizes.includes(def) ? def : sizes[0];
  sel.innerHTML = sizes.map(s => '<option' + (s === keep ? ' selected' : '') + '>' + s + '</option>').join('');
}
// 이불커버는 솜이 없어 두께(온스)가 없고, 대신 연결 똑딱이 갯수를 받는다.
// 칸을 감추지 않으면 고르지도 않은 값이 주문에 딸려 나간다. [대표, 2026-08-05]
function syncQuiltKind(){
  const k = quiltKind();
  $('#q_ozFld').hidden = !k.oz;
  $('#q_snapFld').hidden = !k.snap;
  fillSizes($('#q_size'), k.sizes, DEF_SIZE.quilt);
}
function syncMatKind(){ fillSizes($('#m_size'), matKind().sizes, DEF_SIZE.mattress); }
// 똑딱이 갯수. 숫자만 본다 — 값이 없거나 숫자가 아니면 빈 문자열.
const snap = () => { const v = $('#q_snap').value.replace(/[^0-9]/g,''); return v ? +v + '' : ''; };
$('#q_kind').onchange = syncQuiltKind;
$('#m_kind').onchange = syncMatKind;
syncQuiltKind();
syncMatKind();

/* ---- 사이즈: 안 할래요 체크 시 비활성 ---- */
[['q_skip','grpQuilt'],['m_skip','grpMat'],['p_skip','grpPil']].forEach(([c,g]) => {
  $('#'+c).onchange = e => { $('#'+g).classList.toggle('off', e.target.checked); checkHeight(); };
});

/* ---- 확인 화면 ---- */
function buildMini(){
  const mini = $('#sceneMini');
  // 지금 디자인의 사진 한 벌만 베낀다. 전부 베끼면 안 보이는 사진까지 한 장 더 그린다.
  if (!mini.dataset.built) {
    mini.innerHTML = $('#sceneMain .scene:not([hidden])').outerHTML;
    mini.dataset.built = '1';
  }
  PARTS.forEach(p => {
    const l = mini.querySelector('[data-part="'+p.key+'"]');   // 다른 디자인 부위는 없다
    if (l) l.style.backgroundColor = paintOf(p);
  });
}
/* ---- 견적 ----
   판매가와 맞춤 추가금이 둘 다 있어야 금액이 나온다.
   하나라도 비었거나 수량·사이즈가 확정되지 않으면 그 줄은 "가격 문의"로 두고 합계에서 뺀다. */
const won = n => n.toLocaleString('ko-KR') + '원';
function quote(){
  const rows = [], notes = [];
  let sum = 0, ask = false, bad = false;
  const add = r => { rows.push(r); if (r.bad) bad = true; else if (r.ask) ask = true; else sum += r.a; };
  // 맞춤 추가금이 실제로 붙은 줄이 하나라도 있어야 「추가금이 포함된 금액」이라고 말한다.
  // 베개커버만 사시면 추가금이 0이라, 늘 말하면 거짓말이 된다. [2026-08-06]
  let usedCustom = false;
  const fee = (sale, custom) => {
    if (sale == null || (ALWAYS_CUSTOM && custom == null)) return null;
    if (ALWAYS_CUSTOM && custom) usedCustom = true;
    return sale + (ALWAYS_CUSTOM ? custom : 0);
  };

  if (!$('#q_skip').checked) {
    const k = quiltKind(), size = $('#q_size').value, n = +$('#q_qty').value;
    const p = fee(PRICE.quilt.sale[k.key][size], PRICE.quilt.custom);
    // 양면은 값이 무지와 같다 [대표, 2026-08-06]. 값은 같아도 무엇을 주문했는지는 보여야 한다.
    const d = designKo() + ' · ' + k.ko + ' · ' + size + (n > 1 ? ' · ' + n + '장' : '');
    add(p == null ? { t:'이불', d, ask:'가격 문의' } : { t:'이불', d, a:p * n });
    if (k.snap && !snap()) notes.push('이불 연결 똑딱이 갯수를 적어주세요. 쓰시던 이불의 똑딱이 수와 맞춰 만듭니다.');
  }
  if (!$('#m_skip').checked) {
    const k = matKind(), size = $('#m_size').value, n = +$('#m_qty').value;
    let unit = fee(PRICE.mattress.sale[k.key][size], PRICE.mattress.custom),
        d = k.short + ' · ' + size, tall = false;
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
    if (!matWH()) notes.push(matWHJunk()
      ? '매트리스 가로·세로를 숫자로 적어주세요. (예: 가로 150, 세로 200)'
      : '매트리스 가로·세로를 적어주세요. 만들 때 쓰는 치수입니다.');
    if (n > 1) d += ' · ' + n + '장';
    add(tall ? { t:'매트리스커버', d, ask:'주문 불가', bad:true }
      : unit == null ? { t:'매트리스커버', d, ask:'가격 문의' } : { t:'매트리스커버', d, a:unit * n });
  }
  if (!$('#p_skip').checked) {
    // 사이즈마다 값이 다르므로 사이즈별로 한 줄씩 낸다.
    for (const [size, n] of pillowBySize()) {
      const unit = fee(PRICE.pillow.sale[size], PRICE.pillow.custom);
      const d = size + ' · ' + n + '장';
      // k = 줄이 여럿일 때 구분하는 꼬리표. 복사 텍스트에서 "베개커버"만 두 줄 나오는 걸 막는다.
      add(unit == null ? { t:'베개커버', k:size, d, ask:'가격 문의' } : { t:'베개커버', k:size, d, a:unit * n });
    }
    // 양면 베개커버 추가금 — 천이 두 종류라 붙는다. 사이즈와 무관해 한 줄로 낸다.
    const TW = PRICE.pillow.two, np = pillowCount();
    if (pilTwo() && TW && np) {
      const blocks = Math.ceil(np / TW.per);
      add({ t:'베개커버', k:'양면 추가', a:TW.add * blocks,
        d:'양면 ' + np + '장 · ' + TW.per + '장까지 ' + won(TW.add)
          + (blocks > 1 ? ' × ' + blocks : '') });
    }
  }
  // 양면으로 고르셨는데 앞뒤 색이 같으면 알린다. 그대로 둬도 값은 같지만,
  // 손님이 뒷면을 안 고른 것일 수 있고 그러면 대표가 「양면인데 왜 한 색?」을 물어봐야 한다.
  // 양면인데 앞뒤가 같은 색이면 알린다. 베개까지 같은 색을 쓰므로 한 번만 말하면 된다.
  if (!$('#q_skip').checked) {
    const qp = quiltParts();
    if (qp.length > 1 && qp.every(p => state[p.key].hex === state[qp[0].key].hex))
      notes.push('양면으로 고르셨는데 앞면과 뒷면 색이 같습니다. 그대로 하셔도 되고 ② 색에서 바꾸실 수 있습니다.');
  }
  if (usedCustom) notes.unshift('맞춤 제작 추가금이 포함된 금액입니다.');
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
  if (!$('#q_skip').checked) {
    const k = quiltKind();
    // 디자인은 늘 적는다. 「무지」라고 못박아야 양면이 아님이 분명해진다.
    L.push('■ 이불', '   디자인 : ' + designKo(), '   종류 : ' + k.ko, '   사이즈 : ' + $('#q_size').value);
    if (k.oz) L.push('   두께 : ' + $('#q_oz').value);   // 이불커버는 온스가 없다
    L.push('   수량 : ' + $('#q_qty').value + '장');
    if (k.snap) L.push('   이불 연결 똑딱이 : ' + (snap() ? snap() + '개' : '안 적으심'));
    // 양면이면 이불이 두 부위라 「컬러(앞면)」「컬러(뒷면)」 두 줄이 나간다.
    quiltParts().forEach(p =>
      L.push('   컬러' + (p.face ? '(' + p.face + ')' : '') + ' : ' + label(state[p.key])));
    L.push('');
  }
  if (!$('#m_skip').checked) {
    // 하나만 적으셨어도 적으신 것은 그대로 내보낸다 — 대표가 보고 물어볼 수 있어야 한다.
    const w = $('#m_w').value.trim(), d = $('#m_d').value.trim(), h = $('#m_h').value.trim();
    const wh = (w || d) ? (w || '?') + '×' + (d || '?') : '';
    L.push('■ 매트리스커버', '   종류 : ' + matKind().ko,
      '   규격 : ' + $('#m_size').value, '   수량 : ' + $('#m_qty').value + '장');
    if (wh || h) L.push('   실제 사이즈 : ' + (wh||'-') + (h ? ' / 높이 ' + h : ''));
    L.push('   컬러 : ' + label(matColor()));
    if (tooTall()) L.push('   ※ 높이 ' + H_MAX + 'cm까지만 주문받습니다 — 이 매트리스커버는 만들어 드릴 수 없습니다');
    L.push('');
  }
  if (!$('#p_skip').checked && pillowCount()) {
    // 대표가 주문서에서 바로 알아야 하는 값이다 [대표, 2026-08-06].
    // 「무지」도 적는다 — 안 적으면 양면인지 아닌지 물어봐야 한다.
    const one = slots().length === 1;
    L.push('■ 베개커버', '   종류 : ' + (pilTwo() ? '양면 (앞뒤 다른 색)' : '무지 (앞뒤 같은 색)'));
    pillowRows().forEach(r => {
      // 칸이 하나면 칸 이름이 「베개커버」라 바로 위 줄과 겹친다. 사이즈로 적는다.
      const head = '   ' + (one ? '사이즈' : r.sl.ko) + ' : ' + r.size + ' · ' + r.n + '장';
      // 한 색이면 한 줄에 붙이고, 양면처럼 두 색이면 색을 아래에 따로 적는다.
      if (r.sl.faces.length === 1) L.push(head + '  /  ' + label(state[r.sl.faces[0].part]));
      else { L.push(head); r.sl.faces.forEach(f => L.push('      컬러(' + f.face + ') : ' + label(state[f.part]))); }
    });
    // 칸이 하나면 합계가 바로 위 줄과 같은 말이다.
    if (!one) L.push('   모두 ' + pillowCount() + '장 ('
      + pillowBySize().map(([s,c]) => s + ' ' + c + '장').join(', ') + ')');
    L.push('');
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

syncDesign();
goto(0);      // 단추 글씨·부제목까지 한 곳에서 정해진다. HTML 에 적어두면 어긋난다.
// 첫 화면도 기록에 심어둔다. 없으면 뒤로가기로 돌아왔을 때 어느 단계였는지 알 수 없다.
try { history.replaceState({ step:0 }, ''); } catch(_) {}
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
// 컬러 데이터도 저장소 루트에 공개용으로 함께 내보낸다.
// k 는 페이지 안에서만 쓰는 키라 공개 파일에서는 뺀다.
fs.writeFileSync(path.join(ROOT, 'colors.json'),
  JSON.stringify(SW, (key, v) => key === 'k' ? undefined : v, 1), 'utf8');

const kb = Math.round(fs.statSync(path.join(ROOT,'index.html')).size / 1024);
const dz = DESIGNS.map(d => `${d.ko} ${PARTS.filter(p => inDz(p, d.key) && pickable(p)).length}곳`).join(' · ');
const steps = (html.match(/<section class="step"/g) || []).length;
console.log(`index.html 생성 — 원단 ${total}색 / 디자인 ${DESIGNS.length}가지 (${dz}) / ${steps}단계 / ${kb}KB`);
