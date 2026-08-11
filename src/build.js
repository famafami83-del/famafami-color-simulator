/**
 * 컬러 시뮬레이터 페이지를 만든다.
 *   실행:  node src/build.js       (어느 폴더에서 실행해도 된다)
 *   결과:  index.html  ← 저장소 루트에 덮어쓴다. 이 파일이 그대로 배포된다.
 *
 * 그림은 두 갈래로 나뉜다.
 *   b64() — **첫 화면에 바로 보이는 것**(표지·워드마크·디자인 카드·폰트)은 페이지 안에
 *           base64 로 넣는다. 파일을 따로 받으러 가지 않으니 열자마자 그려진다.
 *   ext() — **디자인마다 딸린 사진과 마스크**는 `assets/` 폴더에 밖으로 뺀다.
 *           디자인이 몇 가지로 늘어도 첫 화면은 그대로고, **고른 디자인 것만 그때 받는다.**
 *
 * ★ 그래서 `index.html` 을 두 번 눌러 여는 방식은 ② 색 화면에서 깨진다 — CSS 마스크는
 *   file:// 에서 밖의 파일을 못 읽는다. 확인은 `node src/tools/preview.js` 로 한다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC    = __dirname;
const ROOT   = path.join(SRC, '..');
const ASSETS = path.join(SRC, 'assets');
const OUT    = path.join(ROOT, 'assets');   // 밖으로 뺀 사진·마스크가 놓이는 자리

const SW = JSON.parse(fs.readFileSync(path.join(SRC, 'swatches.json'), 'utf8'));
const b64 = (f, m) => `data:${m};base64,` + fs.readFileSync(path.join(ASSETS, f)).toString('base64');

// 페이지 밖 파일로 내보낸다. 돌려주는 것은 그 파일의 주소다.
//   주소에 붙는 `?v=` 는 **파일 내용에서 뽑은 값**이다. 사진을 다시 뽑았는데 폰이 옛것을
//   붙들고 있는 일을 막는다. 내용이 그대로면 값도 그대로라 쓸데없이 다시 받지 않는다.
const OUTFILES = new Map();                 // 내보낼 파일 이름 → 원본 경로
const ext = f => {
  const src = path.join(ASSETS, f);
  const v = crypto.createHash('md5').update(fs.readFileSync(src)).digest('hex').slice(0, 8);
  OUTFILES.set(f, src);
  return `assets/${f}?v=${v}`;
};

// 사진의 원래 크기. `<img>` 에 적어두면 사진이 오기 전에 **자리를 미리 잡는다.**
// 안 적으면 사진이 뜨는 순간 아래 내용이 밀려 내려간다 — 밖으로 뺐기 때문에 생긴 일이다.
const imgSize = f => {
  const b = fs.readFileSync(path.join(ASSETS, f));
  if (b[0] === 0x89 && b[1] === 0x50)                          // PNG — IHDR 이 맨 앞에 있다
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  for (let i = 2; i + 9 < b.length; ) {                        // JPEG — SOF 표를 찾아간다
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }                          // 채움 바이트
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${f} 의 가로세로를 못 읽었습니다 — 사진이 깨졌는지 보십시오`);
};

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

// 베개 자리: 앞줄 왼쪽=pillowL, 앞줄 오른쪽=pillowF, 뒷줄 왼쪽=pillowW, 뒷줄 오른쪽=pillowR
//   **키 이름을 믿지 말 것** — 자리와 안 맞는다 (PARTS 의 베개 넷에 적어둔 까닭 참조).
//   확실히 하려면 `src/tools/extract-masks.js` 의 label 을 보거나, 마스크마다 다른 색을
//   넣어 한 장 뽑아 보십시오. 눈으로 보는 것이 제일 빠릅니다.
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
// pilTwo = 베개커버도 앞뒤를 다르게 만드는 디자인인지. 켜면 **묻지 않고 늘 양면**이다
//   [대표, 2026-08-07]. 전에는 체크칸으로 물었지만 지금은 물음 자체가 없다.
// ko     = 카드 제목이자 손님이 보는 디자인 이름. 주문서·견적에도 이 이름이 나간다.
//   전에는 「무지 / 양면」이었는데 [대표, 2026-08-07] 에 바꿨다. 사실 **둘 다 무지**다 —
//   패턴이 없다는 점은 같고 다른 것은 이불 앞뒤 색뿐이라, 다른 데를 이름으로 삼았다.
// d      = 한 줄짜리. ② 화면 맨 위 띠(「같은 컬러 · 패턴 없는 디자인」)에 쓴다.
// cd     = 카드 안에 넣을 줄들. 두 카드가 같은 짜임이라야 나란히 놓았을 때 견주기 쉽다.
//   ★ 「이불 · 베개커버 · 매트리스커버」와 매트리스 사이즈 맞춤 안내는 **카드에 안 쓴다.**
//     바로 위 공통 설명에서 이미 말했다. 두 번 쓰면 카드가 지저분해진다.
// on     = **밖으로 나가는 이름** (견적 금액 · 주문서). 화면 이름(ko)보다 길게 적는다.
//   **「무지」는 붙이지 않는다** [대표, 2026-08-07]. 2026-08-06 까지는 대표가 그동안
//   불러온 이름이라 「무지 · 앞뒤 같은 컬러」로 둘을 같이 적었는데, 패턴이 없다는 점은
//   두 디자인이 똑같아서 **가리는 말이 못 되고** 같은 말만 겹쳐 보였다.
//   베개커버 주문서도 「앞뒤 같은 컬러 / 앞뒤 다른 컬러」라 이제 온 페이지가 한 말을 쓴다.
// pilMode = 베개커버 칸 구성. 없으면 pilTwo 를 보고 정한다 (PIL_MODES 참조).
// cd = 카드에 적는 설명. 줄 단위로 적는다.
//   ★ 「패턴 없는 디자인」을 넷에서 다 뺐다 [대표, 2026-08-10]. 네 카드에 똑같이 붙어 있어서
//     **디자인끼리 무엇이 다른지**를 알려주지 못하고 자리만 먹었다. 넷이 공통으로 참인 말은
//     카드에 적지 말 것 — 카드는 다른 점을 보여주는 자리다.
//   ② 색 화면 맨 위에도 이 첫 줄이 나간다 (`#dnowD`). 전에는 따로 `d` 를 뒀는데
//     거기에도 같은 「패턴 없는 디자인」이 찍혀서 함께 없앴다.
const DESIGNS = [
  { key:'plain', ko:'같은 컬러', on:'앞뒤 같은 컬러',
    cd:['이불 앞뒤 같은 컬러'], card:'card_plain.jpg', base:'base.jpg' },
  //   onSame — 앞뒤를 **같은 색으로** 고르셨을 때 나가는 이름. 값이 그렇게 갈리므로
  //   (PRICE.design.both.twoByColor) 주문서 이름도 반드시 같이 갈려야 한다 [대표, 2026-08-10].
  //   이름만 「다른 컬러」로 남으면 **같은 컬러 값이 청구된 주문서**가 나간다.
  { key:'both',  ko:'다른 컬러', on:'앞뒤 다른 컬러', onSame:'앞뒤 같은 컬러',
    cd:['이불 앞뒤 다른 컬러'], card:'card_both.jpg',  base:'base_both.jpg',
    pilTwo:true },
  // 삥(테두리) — **사진은 「다른 컬러」와 같은 컷이다.** 다른 것은 테두리를 손님이
  // 따로 고르느냐뿐이다. 「다른 컬러」에서는 앞면 색으로 덮어 안 보이게 하고
  // (`bothP` 의 follow), 여기서는 `pipP` 로 내어 고르게 한다.
  //   ★ 이름은 **대표가 정한 것이다** [2026-08-10] — 「삥 컬러」는 작업자가 지은 말이라
  //     손님이 못 알아들었다. 화면·주문서 어디에도 「삥」을 쓰지 않는다.
  //   onSame — 앞뒤를 **같은 색으로** 고르셨을 때 밖으로 나가는 이름. 값이 그렇게
  //   갈리므로(PRICE.design.piping.twoByColor) 주문서 이름도 같이 갈려야 한다.
  //   카드 문구는 대표가 적어 주신 그대로다 [2026-08-10] — 이 디자인만 **앞뒤를 같은
  //   색으로도, 다른 색으로도** 고를 수 있고 값이 그에 따라 갈린다. 그것을 카드에서부터
  //   알려야 손님이 골라 들어온다.
  { key:'piping', ko:'line 디자인', on:'앞뒤 다른 컬러 · line', onSame:'앞뒤 같은 컬러 · line',
    //   줄 나눔은 대표가 정한 자리다 [2026-08-10]. 네 줄로 못박는다:
    //     이불 / (같은 컬러, / 양면 다른 컬러 선택 가능) / line 컬러 선택 가능
    //   한 줄로 이어 두었더니 폰에서 「…양면 다른컬러 / 선택가능)」 으로 갈렸다.
    //   ★ 괄호 안을 통째로 두면 20자라 어느 폰에서도 한 줄에 안 들어간다(카드가
    //     화면의 반이다). 쉼표에서 손수 끊으면 뒷줄이 11.5px 로 115px 인데 카드에는
    //     360px 폰에서 134px, 390px 폰에서 149px 이 있다 — 넉넉히 한 줄이다.
    //   ★ 「다른컬러」·「선택가능」을 띄어 쓴다. keep-all 은 **띄어쓴 자리에서만** 꺾는데
    //     붙여 두면 그 덩어리가 통째로 안 꺾여 오히려 이상한 데서 갈린다.
    //   ★ 「선택 가능)」은 안 꺾이는 빈칸으로 묶어 둔다. 아주 좁은 폰(320px)에서는
    //     0.5px 가 모자라 꺾이는데, 그때도 「…가능)」이 홀로 남지 않고 「양면 다른 컬러 /
    //     선택 가능)」으로 갈리게 하는 안전줄이다. (그 폭에서는 글자도 11px 로 내린다)
    cd:['이불', '(같은 컬러,', '양면 다른 컬러 선택 가능)', 'line 컬러 선택 가능'],
    card:'card_piping.jpg', base:'base_both.jpg',
    pilTwo:true, pilMode:'bothPip' },
  // 날개형 [대표, 2026-08-09] — 사진이 **따로**다. 이불 앞뒤가 한 색이고 테두리에
  // 넓은 날개가 둘러 있다. 베개에도 같은 날개가 있어 값과 주문서에 같이 나간다.
  //   베개는 **이불 색을 따라간다** [대표, 2026-08-10]. 그래서 고르는 자리가 셋이다.
  { key:'wing', ko:'날개 디자인', on:'날개 디자인',
    cd:['양면 같은 컬러', '날개 컬러만 선택 가능'],
    card:'card_wing.jpg', base:'base_wing.jpg', pilMode:'wing' },
];
// 카드 설명이 비면 카드가 이름만 남은 채로 나간다. 조용히 새지 않게 여기서 멈춘다.
for (const d of DESIGNS)
  if (!d.cd || !d.cd.length)
    throw new Error(`${d.ko} 의 카드 설명(cd)이 비었습니다 — 카드에 적을 줄을 한 줄 이상 두십시오`);
// 디자인을 바꿔도 **고른 색이 날아가지 않게** 물려준다. 다시 고르게 하면 카드를 둔 뜻이 없다.
// 그 부위에 아직 손을 안 댔을 때만 물려준다 — 갈 때마다 덮으면 무지↔양면을 오가는 사이에
// 양면에서 고른 뒷면 색이 앞면 색으로 지워진다.
//   베개 색은 못 물려준다. 무지는 베개가 네 부위고 양면은 이불과 한 몸이라 짝이 없다.
//   양면↔삥 은 **부위 키가 같아서** 물려줄 것이 없다 — 고른 색이 그대로 살아 있다.
const CARRY = {
  both:   { bothA:'quilt', bothB:'quilt', bothM:'mattress' }, // 무지 → 양면 : 앞뒤 모두 쓰던 색으로
  piping: { bothA:'quilt', bothB:'quilt', bothM:'mattress' }, // 무지 → 삥  : 위와 같다
  plain:  { quilt:'bothA', mattress:'bothM' },                // 양면·삥 → 무지 : 앞면 색을 가져온다
  wing:   { wQuilt:'quilt', wMat:'mattress' },                // 무지 → 날개형 : 이불·매트리스만
};
// dz     = 이 부위가 나오는 디자인. 없으면 모든 디자인에 나온다.
//   ★ 한 부위가 여러 디자인에 나올 수 있다 (양면·삥은 사진이 같다). 그때는 사진마다
//     층이 하나씩 생기고 **색을 고르면 전부 같이 칠해진다** — 페이지 안 `layers` 참조.
// grp    = 주문서에서 한 덩어리로 묶는 이름. 양면이면 이불이 두 부위라 묶을 데가 필요하다.
// face   = 주문서에 「컬러(앞면)」처럼 붙일 말. 한 면뿐이면 없다.
// follow = 손님이 고르지 않고 **다른 부위 색을 따라가는** 자리. 단추도 안 만든다.
// mask   = 마스크 파일 이름. 없으면 `mask_{key}.png`. 다른 부위와 **같은 마스크를
//          나눠 쓸 때** 적는다 (삥은 양면과 같은 자리를 가리킨다).
// trim   = 이불의 **테두리**다. 이불 덩어리에 같이 적히지만 「앞뒤가 같은 색인가」를
//          따질 때는 빠진다 — 그것은 앞면·뒷면끼리의 이야기다.
const PARTS = [
  // ── 무지 (base.jpg)
  { key:'quilt',    ko:'이불',            def:WHITE, su:null,     dz:['plain'], grp:'quilt' },
  { key:'mattress', ko:'매트리스커버',     def:WHITE, su:[60,80], suWhy:'100수는 얇아서 쓰지 않습니다',
    dz:['plain'], grp:'mat' },
  // ★ 베개 넷 — **키 이름과 사진 속 자리는 다르다** [대표, 2026-08-10].
  //   이름 넷이 통째로 밀려 있어서, 고른 색이 엉뚱한 베개에 칠해졌다. 대표가 사진에
  //   자리를 적어 보내주셔서 맞췄다. 마스크에 색을 하나씩 넣어 눈으로 확인한 결과다:
  //     pillowL = 왼쪽 뒤에 큰 것 (앞줄 왼쪽)   pillowW = 그 뒤에 반쯤 가린 것 (뒷줄 왼쪽)
  //     pillowF = 가운데 앞    (앞줄 오른쪽)    pillowR = 오른쪽       (뒷줄 오른쪽)
  //   **키는 안 바꿨다** — 마스크 파일 이름(mask_pillowF.png …)이 키를 따라가므로
  //   키를 고치면 파일까지 다 갈아야 한다. 자리는 `ko` 가 정한다.
  //   칸 순서는 손님이 보는 순서(앞 왼쪽 → 앞 오른쪽 → 뒤 왼쪽 → 뒤 오른쪽)로 둔다.
  { key:'pillowL',  ko:'베개(앞)-왼쪽',    def:WHITE, su:null,     dz:['plain'] },
  { key:'pillowF',  ko:'베개(앞)-오른쪽',  def:WHITE, su:null,     dz:['plain'] },
  { key:'pillowW',  ko:'베개(뒤)-왼쪽',    def:WHITE, su:null,     dz:['plain'] },
  { key:'pillowR',  ko:'베개(뒤)-오른쪽',  def:WHITE, su:null,     dz:['plain'] },
  // ── 양면·삥 (base_both.jpg 한 장을 나눠 쓴다). 이불과 베개가 한 부위다.
  { key:'bothA',    ko:'이불·베개 앞면',   def:WHITE, su:null,     dz:['both','piping'], grp:'quilt', face:'앞면' },
  { key:'bothB',    ko:'이불·베개 뒷면',   def:WHITE, su:null,     dz:['both','piping'], grp:'quilt', face:'뒷면' },
  { key:'bothM',    ko:'매트리스커버',     def:WHITE, su:[60,80], suWhy:'100수는 얇아서 쓰지 않습니다',
    dz:['both','piping'], grp:'mat' },
  // 같은 자리(삥)를 디자인마다 다르게 쓴다. 마스크는 한 장을 나눠 쓴다.
  //   bothP — 「다른 컬러」에는 line이 **없는 제품**이라, 앞면 색으로 덮어 봉제선처럼 보이게 한다.
  //   pipP  — 「line 디자인」에서는 손님이 **직접 고르는 자리**다.
  { key:'bothP',    ko:'line(테두리)',     def:WHITE, su:null,     dz:['both'],   follow:'bothA' },
  //   face 는 「컬러(line)」으로 짧게 적는다 — 「컬러(line(테두리))」는 괄호가 겹쳐 읽기 나쁘다.
  //   ★ 「삥」은 작업자끼리 쓰는 말이라 **손님 눈에 닿는 데는 한 군데도 없어야 한다**
  //     [대표, 2026-08-10]. 부위 키(pipP)와 마스크 이름만 옛 말로 남아 있다.
  //   ★ 테두리도 **100수를 고를 수 있다** [대표, 2026-08-11]. 2026-08-10 에는 「얇아서
  //     테두리나 날개로 쓰기엔 힘이 없다」며 60·80수만 두었는데, 대표가 도로 열어
  //     주셨다. 날개(wWing)도 같이 열었다 — 두 곳은 늘 같이 간다.
  //     매트리스커버(bothM·wMat·mattress)는 **그대로 막아둔다.** 까닭이 다르다 —
  //     거기는 천이 얇아서 안 쓰는 것이고, 여기는 테두리를 잡아주느냐의 이야기였다.
  { key:'pipP',     ko:'line(테두리)',     def:WHITE, su:null,
    dz:['piping'], grp:'quilt', face:'line', trim:true, mask:'mask_bothP.png' },
  // ── 날개형 (base_wing.jpg). 사진이 따로다 — 이불 앞뒤가 한 색이고 테두리에 날개가 있다.
  //   마스크는 `src/tools/extract-wing.js` 가 뽑는다.
  { key:'wQuilt',   ko:'이불',            def:WHITE, su:null,     dz:['wing'], grp:'quilt' },
  // 베개 몸판 — **이불 색을 따라간다** [대표, 2026-08-10]. 따로 고를 수 있게 해뒀더니
  // 「그냥 같은 컬러로만 고르게 해달라」고 하셨다. 단추가 사라지고 이불을 고르면 같이 칠해진다.
  //   ★ 따로 고르게 되돌리려면 follow 만 지우고, 아래 PIL_MODES.wing 의 「바탕」 면을
  //     wQuilt 에서 wPillow 로 되돌리면 된다 — 마스크는 그대로 있다.
  { key:'wPillow',  ko:'베개',            def:WHITE, su:null,     dz:['wing'], follow:'wQuilt' },
  { key:'wMat',     ko:'매트리스커버',     def:WHITE, su:[60,80], suWhy:'100수는 얇아서 쓰지 않습니다',
    dz:['wing'], grp:'mat' },
  //   ★ 날개도 line 테두리와 같이 **100수를 고를 수 있다** [대표, 2026-08-11].
  //     둘은 늘 같이 간다 — 한쪽만 열면 손님이 「왜 여기만 안 되지」로 걸린다.
  { key:'wWing',    ko:'날개(테두리)',     def:WHITE, su:null,
    dz:['wing'], grp:'quilt', face:'날개', trim:true },
  // 뒤에 놓인 베개. 사진에 조금 보이는데 **혼자 흰색으로 남으면 고장 난 것처럼 보인다.**
  //   ★ 앞 베개가 아니라 **이불을 따라간다.** 따라가는 자리를 또 따라가는 것은 안 된다 —
  //     apply() 가 한 단계만 퍼뜨려서, wPillow 를 가리켜 두면 여기만 흰 채로 남는다.
  { key:'wPillowB', ko:'뒤 베개',          def:WHITE, su:null,     dz:['wing'], follow:'wQuilt' },
];
const inDz  = (p, d) => !p.dz || p.dz.includes(d);
const pickable = p => !p.follow;          // 손님이 눌러서 고르는 부위인가
const maskOf = p => p.mask || `mask_${p.key}.png`;
// 마스크가 없는 부위를 적어두면 그 자리만 색이 안 먹는 페이지가 조용히 나간다.
for (const p of PARTS)
  if (!fs.existsSync(path.join(ASSETS, maskOf(p))))
    throw new Error(`${p.ko}(${p.key}) 마스크 ${maskOf(p)} 가 없습니다 — src/tools/ 의 마스크 도구를 돌리셨습니까`);
for (const d of DESIGNS)
  for (const [what, f] of [['카드 사진', d.card], ['바탕 사진', d.base]])
    if (!fs.existsSync(path.join(ASSETS, f)))
      throw new Error(`${d.ko} ${what}(${f})이 없습니다 — src/tools/ 의 도구를 돌리셨습니까`);
// ① 표지 재료. 없으면 첫 화면이 통째로 빈 채로 나간다.
for (const [f, tool] of [['hero.jpg', 'brand-hero.js'], ['logo.png', 'brand-logo.js']])
  if (!fs.existsSync(path.join(ASSETS, f)))
    throw new Error(`표지 재료 ${f} 가 없습니다 — src/tools/${tool} 를 돌리셨습니까`);
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
  // 칸 이름과 **가리키는 부위**가 짝이 맞아야 한다 [대표, 2026-08-10]. 전에는 넷이 다
  // 밀려 있어서, 「베개(앞)-왼쪽 · 1장」을 주문했는데 주문서에는 가운데 앞 베개 색이 적혔다.
  //   칸 키(L·R·L2·R2)는 안 바꾼다 — 화면의 사이즈·장수 칸이 이 키로 붙어 있고,
  //   디자인을 오가도 적어둔 값이 살아남는 근거다(PIL_UNION).
  //   기본 장수는 **앞 두 자리가 1장** 이다. 뒤 두 자리는 0장으로 두고 필요하면 늘리신다.
  single: [
    { key:'L',  ko:'베개(앞)-왼쪽',   qty:1, faces:[{ part:'pillowL' }] },
    { key:'R',  ko:'베개(앞)-오른쪽', qty:1, faces:[{ part:'pillowF' }] },
    { key:'L2', ko:'베개(뒤)-왼쪽',   qty:0, faces:[{ part:'pillowW' }] },
    { key:'R2', ko:'베개(뒤)-오른쪽', qty:0, faces:[{ part:'pillowR' }] },
  ],
  // 한 칸이 네 칸 몫을 하므로 장수 목록을 늘려 잡는다. 안 그러면 무지에서 8장까지
  // 되던 것이 양면에서 4장으로 조용히 줄어든다.
  bothTwo: [
    { key:'B', ko:'베개커버', qty:2, many:true,
      faces:[{ part:'bothA', face:'앞면' }, { part:'bothB', face:'뒷면' }] },
  ],
  // ★ bothPlain 은 **지금 안 씁니다** [대표, 2026-08-07]. 「베개커버도 앞뒤를 다르게」
  //   체크칸을 없애면서 「다른 컬러 + 베개는 한 색」이라는 경우가 사라졌습니다.
  //   지우지 않고 두는 것은 되살릴 때 다시 짜지 않아도 되게 하려는 것입니다.
  //   되살리려면 체크칸을 만들고 slots() 에서 이 칸을 다시 고르게 하면 됩니다.
  bothPlain: [
    { key:'B', ko:'베개커버', qty:2, many:true, faces:[{ part:'bothA' }] },
  ],
  // 삥 — 양면과 같은 한 칸인데 색이 하나 더 붙는다. 베개에도 삥이 둘러 있어
  // 주문서에 **테두리 색까지** 적어야 대표가 물어보지 않는다.
  //   칸 이름(key)을 양면과 같은 'B' 로 둔다 — 그래야 적어둔 사이즈와 장수가
  //   양면↔삥을 오가도 살아남는다 (PIL_UNION 이 키로 묶는다).
  bothPip: [
    { key:'B', ko:'베개커버', qty:2, many:true,
      faces:[{ part:'bothA', face:'앞면' }, { part:'bothB', face:'뒷면' },
             { part:'pipP',  face:'line' }] },
  ],
  // 날개형 — 몸판 한 색 + 날개. 앞뒤가 갈리지 않아 「바탕」이라고 적는다.
  //   칸 이름(key)을 양면과 같은 'B' 로 둔다 — 디자인을 오가도 사이즈·장수가 살아남는다.
  //   ★ 바탕 면이 가리키는 곳은 `wPillow` 가 아니라 **`wQuilt`** 다. 베개가 이불 색을
  //     따라가게 바꾸면서(follow) 그렇게 됐다. 따라가는 자리는 `state` 가 안 바뀌므로
  //     `wPillow` 를 가리켜 두면 **주문서에만 흰색이 적혀 나간다.**
  wing: [
    { key:'B', ko:'베개커버', qty:2, many:true,
      faces:[{ part:'wQuilt', face:'바탕' }, { part:'wWing', face:'날개' }] },
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
// 이제 모든 베개 사이즈에 값이 있다. 다른 사이즈는 「요청사항」으로 받는다.
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

// 양면(앞뒤 다른 색)으로 만드는 이불에 붙는 웃돈 — **사이즈마다 다르다** [대표, 2026-08-10].
//   「같은 컬러」를 0 으로 놓고 그보다 얼마나 더 받는지다.
//   ★ 왜 슈퍼싱글만 0 인가 — **들어가는 원단 마수 때문이다** [대표, 2026-08-10].
//     「슈퍼싱글은 양면이어도 들어가는 원단 마수가 같은데, 퀸부터는 양면이면 마수가 다르다.」
//     값 정책이 아니라 **원단이 실제로 더 드는가**가 정합니다. 그래서 이 표를 손댈 때는
//     **마수가 바뀌었는지**를 먼저 물어야 한다 — 균일하게 얹거나 깎으면 안 된다.
//     날개 디자인이 이 표에 없는 것도 같은 이유다. 앞뒤가 한 색이라 마수가 안 갈린다.
//   슈퍼싱글은 차렵이불(150×210)과 이불커버(160×210)의 치수가 다르므로
//   **두 줄 다 적어야 한다** — 한 줄만 적으면 나머지 종류가 조용히 0 이 된다(아래에서 막는다).
//   이불커버도 차렵이불과 같은 웃돈이다 [대표, 2026-08-10] — 마수가 같기 때문이다.
const TWO_ADD = {
  '슈퍼싱글 150×210': 0,       // 차렵이불
  '슈퍼싱글 160×210': 0,       // 이불커버
  '퀸 200×230':   15000,
  '킹 220×240':   25000,
  '라지킹 240×240': 25000,
};
// line 디자인 이불은 **양면 위에 테두리를 따로 고르는 제품**이라 양면 웃돈에 얹는다
// [대표, 2026-08-10]. 얹지 않으면 퀸부터 line 이 「다른 컬러」보다 싸져서 값이 뒤집힌다.
const LINE_ADD = 10000;
const addOn = (table, n) =>
  Object.fromEntries(Object.entries(table).map(([size, v]) => [size, v + n]));

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
    // 양면 베개커버 — **1장당 5,000원**이 더 든다 [대표, 2026-08-07].
    // 천이 두 종류라 무지와 값이 같을 수 없다. 이불 양면은 값이 같지만 베개는 다르다.
    //   ★ 이 값은 **단가에 녹여서** 계산하고 손님에게는 말하지 않는다. 그래서 화면에는
    //   양면 베개커버가 그냥 「33,000원」으로 보인다 (28,000 + 5,000). 줄을 따로 내거나
    //   「2장까지 10,000원」처럼 적어뒀더니 추가금이 또 붙는 것으로 읽혔다.
    //   2026-08-06 까지는 「2장까지 10,000원」을 **덩어리로** 붙였다. 3장이면 20,000원이
    //   되어 장당 값이 들쭉날쭉했는데, 이제 장수에 그대로 비례한다.
    two: { add: 5000 },
  },
  // 디자인마다 붙는 웃돈 [대표, 2026-08-09]. **「같은 컬러」를 0 으로 놓고** 그보다 얼마나
  // 더 받는지를 적는다. 적어두지 않은 디자인은 웃돈이 없다.
  //   quilt      : 이불 1장당 더 받는 값. 적는 법이 셋이다.
  //                · 숫자 하나            → 사이즈와 무관하게 같은 값
  //                · 표 (TWO_ADD 꼴)      → 사이즈마다 갈린다. 사이즈가 하나도 빠지면 안 된다
  //                · { same, two }        → **고르신 색**이 정한다 (twoByColor 인 디자인만).
  //                                         same·two 안에는 다시 숫자나 표를 적는다.
  //   pillow     : 베개커버 1장당 더 받는 값. **양면 웃돈 위에 얹는다** (대신하지 않는다).
  //   twoByColor : 양면 웃돈(pillow.two.add)과 quilt 의 { same, two } 를 **손님이 실제로
  //                앞뒤를 다른 색으로 고르셨을 때만** 붙인다.
  //     대표 말 [2026-08-09]: 「앞뒤를 같은 컬러로 하면 무지에 추가금이 붙고,
  //     양면을 다른 컬러로 선택하면 양면 디자인 가격에 추가금이 붙게.」
  //     line 은 **테두리를 고르는 디자인**이지 양면을 고르는 디자인이 아니다. 앞뒤를 같은
  //     색으로 두시면 천이 한 종류라 「같은 컬러」 값이 기준이 된다.
  //       앞뒤 같은 색 → 28,000 + 1,000 = 29,000
  //       앞뒤 다른 색 → 28,000 + 5,000 + 1,000 = 34,000
  //     ★ 「다른 컬러」에도 **이 규칙을 건다** [대표, 2026-08-10]. 2026-08-07 에는 「양면
  //       제품을 고르신 것이니 같은 색이어도 천은 두 종류로 만든다」였는데, 대표가
  //       「다른 컬러도 마수 기준으로 맞춰줘」라고 뒤집으셨다. **값은 카드가 아니라
  //       원단이 정한다** — 같은 색이면 「같은 컬러」와 이불도 베개도 값이 같아진다.
  //   ★ 날개형에는 twoByColor 를 두지 않는다 [대표, 2026-08-10]. 날개형은 **이불 앞뒤가
  //     같은 컬러**인 디자인이라(pilTwo 가 없다) 양면 웃돈 5,000 이 아예 붙지 않는다.
  //     그래서 웃돈이 얹히는 자리가 하나뿐이다 — 삥처럼 고른 색에 따라 값이 갈리지 않는다.
  //       베개커버 → 28,000 + 3,000 = 31,000
  //       이불     → 사이즈값 + 15,000 (사이즈와 상관없이 일괄이다)
  //   ★ 이불 웃돈이 **사이즈마다 갈리는 것은 양면(both·piping)뿐이다** [대표, 2026-08-10].
  //     2026-08-06 까지는 「양면 이불 값은 무지와 같다」였는데 대표가 뒤집으셨다.
  //     날개형은 앞뒤가 한 색이라 여기 해당이 없고 일괄 15,000 그대로다.
  design: {
    // 앞뒤 다른 색으로 만드는 이불 — 슈퍼싱글 0 · 퀸 15,000 · 킹·라지킹 25,000 [대표, 2026-08-10]
    //   ★ 여기도 **고르신 색**이 정한다 [대표, 2026-08-10] — 「다른 컬러도 마수 기준으로
    //     맞춰줘」. 2026-08-07 의 「양면 제품을 고르신 것이니 같은 색이어도 값이 안
    //     바뀐다」를 뒤집은 것이다. **값은 카드가 아니라 원단이 정한다.**
    //     같은 색을 고르시면 천이 한 종류라 「같은 컬러」와 값이 같아진다 — 이불도 베개도.
    both:   { quilt: { same: 0, two: TWO_ADD }, twoByColor: true },
    // line 이불은 **고르신 색이 값을 정한다** [대표, 2026-08-10].
    //   same — 앞뒤를 같은 색으로 고르시면 원단 마수가 안 늘어난다. 테두리 몫만 받는다.
    //   two  — 앞뒤를 다른 색으로 고르시면 그 위에 양면 마수가 얹힌다.
    //   손으로 더해 적지 말 것 — TWO_ADD 를 고쳤을 때 여기만 옛 값으로 남는다.
    //   ★ 카드를 둘로 쪼개지 않는다 [대표, 2026-08-10]. 「가격만 구분해 달라」는 것이라
    //     화면은 line 카드 하나 그대로고, 값만 고른 색을 따라 갈린다. 주문서 이름도
    //     같이 갈린다 (DESIGNS.piping 의 on · onSame) — 둘 다 madeTwo() 하나가 정한다.
    piping: { quilt: { same: LINE_ADD, two: addOn(TWO_ADD, LINE_ADD) },
              pillow: 1000, twoByColor: true },
    wing:   { quilt: 15000, pillow: 3000 },
  },
};

// 첫 화면에 거는 브랜드 이야기 [대표, 2026-08-06].
//   「딱 열자마자 이불 고르는 칸이 나오니까 브랜드 이미지가 안 산다」는 말에서 나왔다.
//   ① 디자인 화면만 표지처럼 만들고, 카드를 누르면 그때부터 도구가 된다.
// 로고 안 영문 「INSTITUE OF BEDDING RESEARCH」 는 쓰지 않는다 — INSTITUTE 의 오타다.
// 워드마크만 쓴다 (`src/tools/brand-logo.js`).
// 표지 글 [대표, 2026-08-06].
//   브랜드 슬로건에서 **서비스가 무엇인지 바로 알리는 한글 문구**로 바꿨다.
//   「처음 들어온 사람이 3초 안에 여기서 뭘 하는 곳인지 알아야 한다」는 자리라서다.
//   전에 쓰던 것들은 아래에 남겨둔다 — 되돌릴 때 다시 옮겨 적지 않아도 되게.
//     아버지, 어머니, 그리고 가족.
//     Father + Mother + Family.
//     FAMAFAMI creates lasting comfort where each day begins and ends. Rather than
//     following passing trends, we focus on timeless design, carefully selected
//     materials, and thoughtful craftsmanship in Korea. We make bedding for those who
//     value finding what truly suits them and cherishing it for years to come.
//     파마파미는 하루가 시작되고 끝나는 가장 가까운 공간에 오래도록 편안함을 더합니다. …
// 줄바꿈은 대표가 정한 자리다. 저절로 넘어가게 두지 말 것 — 「찾는 침구에서,」 뒤에서
// 끊겨야 두 줄이 대구를 이룬다.
const BRAND = {
  eyebrow: 'FAMAFAMI · EST. 2017',
  title:   ['찾는 침구에서,', '만드는 침구로.'],
  body:    ['좋아하는 걸,', '하나씩 담아보세요.'],
};

/* ──────────────────────────────────────────────────────────────
   ★ 주문을 받을 곳 — **여기 한 줄만 채우면 됩니다.**

   파마파미 카카오톡 채널 채팅방 주소를 적습니다. 채널 관리자센터의
   채널 정보에서 `pf.kakao.com/_XXXXX` 를 확인하고 **뒤에 /chat 을 붙입니다.**
     예) 'https://pf.kakao.com/_abcdEF/chat'

   비워두면 **빌드가 멈춥니다.** 마지막 단계가 「채팅창에 이미지 두 장을
   첨부해주세요」로 되어 있어 채팅방이 없으면 그 말이 갈 곳이 없습니다.

   ★ 카카오는 **링크에 내용을 담아 보내는 길을 열어두지 않았습니다.**
   그래서 「그대로 전송」은 할 수 없습니다. 대신 손님이 저장 단추로 받아 둔
   그림 두 장(침구 사진·주문 내역)을 채팅창에 첨부합니다 [대표, 2026-08-10].
   ────────────────────────────────────────────────────────────── */
// 파마파미 카카오톡 채널 채팅방 [대표, 2026-08-07].
//   카카오 관리자센터는 http:// 로 알려주지만 **https:// 로 적는다.** 그대로 열리고,
//   요즘 브라우저는 http 링크에 경고를 띄운다. 채널 홈은 /chat 없는 주소다 — 그것을 넣으면
//   채팅방이 아니라 소개 화면이 열리므로 빌드가 멈춘다.
const INQUIRY = 'https://pf.kakao.com/_sxeZtb/chat';
// 잘못 적으면 손님이 엉뚱한 데로 간다. 조용히 새지 않게 여기서 멈춘다.
//   ★ 이제 **비워둘 수 없다** [대표, 2026-08-10]. 마지막 단계가 「채팅창에 이미지
//     두 장을 첨부해주세요」로 바뀌었는데 채팅방이 없으면 그 말이 갈 곳이 없다.
//     전에는 비어 있으면 「복사하기」로 물러섰지만, 복사 자체를 없앴다.
if (!INQUIRY)
  throw new Error('INQUIRY(카카오톡 채팅방 주소)가 비었습니다 — 마지막 단계가 채팅창 첨부 방식이라 반드시 있어야 합니다');
if (!/^https:\/\//.test(INQUIRY))
  throw new Error('INQUIRY 는 https:// 로 시작해야 합니다 — 지금 값: ' + INQUIRY);
// 채널 홈(/chat 없음)을 넣으면 채팅방이 아니라 소개 화면이 열린다. 제일 흔한 실수다.
if (/pf\.kakao\.com/.test(INQUIRY) && !/\/chat$/.test(INQUIRY))
  throw new Error('카카오톡 채널 주소는 뒤에 /chat 을 붙여야 채팅방이 열립니다 — 지금 값: ' + INQUIRY);

/* ── 링크 미리보기 ── [대표, 2026-08-11]
   카톡이나 인스타 디엠에 주소를 붙였을 때 뜨는 카드다. 손님이 링크만 보고 「무엇을
   하는 곳인지」 알 수 있어야 눌러 들어온다.
     SITE — **끝에 슬래시까지** 있는 이 페이지의 주소. og:image 를 여기에 이어 붙여
            https:// 로 시작하는 온전한 주소를 만든다. 짧게 적으면 카카오가 못 받는다.
   ★ 저장소 이름을 바꾸거나 도메인을 붙이면 **여기를 같이 고쳐야 한다.** 안 고치면
     미리보기 그림만 조용히 안 뜬다 — 페이지 자체는 멀쩡해서 알아채기 어렵다. */
const SITE = 'https://famafami83-del.github.io/famafami-color-simulator/';
if (!/^https:\/\/.*\/$/.test(SITE))
  throw new Error('SITE 는 https:// 로 시작하고 / 로 끝나야 합니다 — 지금 값: ' + SITE);
const OG = {
  // 제목은 <title> 과 같게 둔다. 카톡 카드의 굵은 첫 줄이 이것이다.
  title: 'FAMAFAMI MADE',
  /* 한 줄짜리 문장이다 [대표, 2026-08-11].

     ★ **카톡 카드에서는 줄을 나눌 수 없다.** 세 가지를 다 해봤고 다 안 됐다:
         · 진짜 줄바꿈 문자      → 빈칸 하나로 바뀌어 이어붙었다
         · <br>                 → 글자 그대로 나온다
         · 안 꺾이는 빈칸(U+00A0) → 이것마저 보통 빈칸으로 펴버린다
       카카오가 빈칸이란 빈칸을 다 하나로 만들어 놓고 제 폭에 맞춰 꺾는다.
       그러니 **줄 나누려 애쓰지 말고 문장을 짧게 쓰는 것이 답이다.**
     ★ 카드는 두 줄에서 말줄임(…)으로 자른다. 한 줄이 한글 스무 자쯤이니
       마흔 자를 넘기면 끝이 잘린다. 지금 문장은 스물일곱 자다.
     ★ 표지 제목(BRAND.title)을 앞에 두어, 링크에서 본 말과 열어서 본 말을 맞춘다. */
  desc:  '찾는 침구에서, 만드는 침구로. 내 취향대로 조합해보세요.',
  // ?v= 를 떼고 쓴다. 카카오는 **페이지 주소**로 캐시를 잡으므로 그림에 번호를 붙여도
  // 새로 안 읽는다. 주소는 짧고 그대로인 편이 여러 곳에서 잘 읽힌다.
  image: ext('og.jpg').split('?')[0],
};
// 설명에 보통 빈칸이 아닌 것(줄바꿈·안 꺾이는 빈칸)이 섞이면, 카드에서 어떻게 나올지
// 알 수 없다. 눈에 안 보이는 글자라 편집하다 섞여 들어가기 쉬워서 여기서 막는다.
//   카톡은 어차피 다 펴서 한 줄로 만든다 — 섞어봐야 얻을 것이 없다 [2026-08-11].
if (OG.desc !== OG.desc.replace(/\s+/g, String.fromCharCode(32)))
  throw new Error('OG.desc 에 보통 빈칸이 아닌 것이 섞였습니다 — 카톡 카드는 한 줄로 폅니다');

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

// 양면 베개커버 값 — 1장당 붙는 값이라 음수면 단가가 깎인다.
// 예전에 쓰던 per(몇 장까지 한 덩어리) 는 없앴다. 남아 있으면 옛 표를 그대로 둔 것이므로 멈춘다.
{
  const t = PRICE.pillow.two;
  if (t && !(t.add >= 0))
    throw new Error('PRICE.pillow.two.add 는 0 이상이어야 합니다 (1장당 붙는 값)');
  if (t && t.per != null)
    throw new Error('PRICE.pillow.two.per 는 없앴습니다 — add 만 두고 1장당 값으로 적으십시오');
}
// 디자인 웃돈 — 없는 디자인에 값을 매겨두면 **아무 데도 안 붙는 채로 조용히 잊힌다.**
for (const [key, o] of Object.entries(PRICE.design || {})) {
  if (!DESIGNS.some(d => d.key === key))
    throw new Error(`PRICE.design.${key} 는 없는 디자인입니다 (DESIGNS 에 ${key} 가 없습니다)`);
  // 숫자 하나이거나, 이불 사이즈를 빠짐없이 적은 표여야 한다.
  //   표에서 빠진 사이즈는 **조용히 0** 이 되어 그 사이즈만 웃돈 없이 팔린다. 여기서 막는다.
  const okAdd = (v, where) => {
    if (v && typeof v === 'object') {
      const all = [...new Set(QUILT_KIND.flatMap(k => k.sizes))];
      const miss = all.filter(s => !(s in v));
      const extra = Object.keys(v).filter(s => !all.includes(s));
      if (miss.length || extra.length)
        throw new Error(`${where} 가 이불 사이즈 목록과 다릅니다`
          + (miss.length  ? `\n  웃돈이 안 적힌 사이즈: ${miss.join(', ')}` : '')
          + (extra.length ? `\n  이불에 없는 사이즈: ${extra.join(', ')}` : ''));
      for (const [s, n] of Object.entries(v))
        if (!(n >= 0)) throw new Error(`${where}['${s}'] 는 0 이상이어야 합니다`);
      return;
    }
    if (!(v >= 0)) throw new Error(`${where} 는 0 이상이어야 합니다 (1장당 더 받는 값)`);
  };
  for (const [what, v] of Object.entries(o)) {
    if (what === 'twoByColor') continue;                 // 값이 아니라 규칙이다
    // 이불 웃돈만 **고르신 색으로 갈릴 수 있다**. 그때는 { same, two } 로 적는다.
    if (what === 'quilt' && v && (v.same !== undefined || v.two !== undefined)) {
      if (!o.twoByColor)
        throw new Error(`PRICE.design.${key}.quilt 를 { same, two } 로 적으려면 twoByColor 가 켜져 있어야 합니다`
          + ` — 고른 색을 안 보는 디자인이라 two 쪽이 아무 데도 안 붙습니다`);
      for (const w of ['same', 'two']) {
        if (v[w] == null) throw new Error(`PRICE.design.${key}.quilt.${w} 가 없습니다 — 둘 다 적으십시오`);
        okAdd(v[w], `PRICE.design.${key}.quilt.${w}`);
      }
      continue;
    }
    // 베개커버 웃돈은 사이즈와 무관하다 (베개는 사이즈가 달라도 값이 같다).
    if (what === 'pillow' && v && typeof v === 'object')
      throw new Error(`PRICE.design.${key}.pillow 는 사이즈별로 나눌 수 없습니다 — 숫자 하나로 적으십시오`);
    okAdd(v, `PRICE.design.${key}.${what}`);
  }
  // 앞뒤가 갈리지 않는 디자인에 이 규칙을 걸어두면 아무 일도 안 하고 잊힌다.
  if (o.twoByColor && !DESIGNS.find(d => d.key === key).pilTwo)
    throw new Error(`PRICE.design.${key}.twoByColor 는 베개가 양면인 디자인에만 씁니다 (pilTwo 가 없습니다)`);
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
// 접어두는 「높이 안내」에는 한 구간씩 줄을 나눠 넣는다. 한 줄로 이으면 폰에서 못 읽는다.
const HT_LINES = HT.map((t, i) =>
  (i ? `~${t.upto}cm` : `${t.upto}cm까지`) + ' — '
  + (t.add ? `+${t.add.toLocaleString('ko-KR')}원` : '추가 없음')
).join('<br>');

const hasPrice = o => Object.values(o).some(v => v && typeof v === 'object' ? hasPrice(v) : v != null);
const PRICE_READY = hasPrice(PRICE);

const total = Object.values(SW).reduce((s,g)=>s+g.colors.length,0);

/* 폰트 — 쓰는 글자만 잘라 넣는다 (`src/tools/subset-fonts.js`).
   심는 이유: 안 심으면 손님 기기에 있는 걸 빌려 쓰게 되어 **아이폰은 애플 산돌고딕,
   윈도우는 맑은 고딕**으로 사람마다 다르게 보인다.
   이름을 원본과 다르게(`FF Head`/`FF Body`) 두는 것은 일부러다 — 잘라낸 글꼴에 없는
   글자(손님이 「요청사항」에 적는 글자)가 나오면 뒤에 적어둔 **기기에 깔린 폰트로
   자연스럽게 떨어진다.** 이름을 `Pretendard` 로 똑같이 주면 그 길이 막힌다.
   폰트가 아직 없으면 **멈추지 않고 넘어간다** — 처음 만들 때는 폰트가 있을 수 없다
   (글자 목록을 index.html 에서 뽑기 때문이다. 도구 머리말 참조). */
const FACE = [
  { file:'font-head.woff2', family:'FF Head', weight:700 },
  { file:'font-body.woff2', family:'FF Body', weight:400 },
];
const fontCss = FACE.map(f => {
  if (!fs.existsSync(path.join(ASSETS, f.file))) {
    console.log(`  ! ${f.file} 이 없어 폰트 없이 만듭니다 — src/tools/subset-fonts.js 를 돌린 뒤 다시 만드십시오`);
    return '';
  }
  return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;`
       + `font-display:swap;src:url(${b64(f.file,'font/woff2')}) format('woff2')}`;
}).join('\n');
const FONT_BODY = "'FF Body','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
const FONT_HEAD = "'FF Head'," + FONT_BODY;

const html = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- 카톡 채팅방에 붙는 「이전 페이지」 주소를 **끝까지** 넘긴다 [대표, 2026-08-07].
     브라우저는 다른 도메인으로 넘어갈 때 기본으로 주소의 **앞부분만**(도메인까지) 넘긴다.
     그래서 카카오가 famafami83-del.github.io 만 받아 적었고, 그 주소에는 아무것도 없어서
     손님과 대표 화면에 **404 가 떴다.** 이 페이지는 /famafami-color-simulator/ 아래 있다.
     주소에 개인정보가 실리지 않는 페이지라 통째로 넘겨도 된다 — 고르신 색도 사이즈도
     주소가 아니라 화면 안에만 있다. -->
<meta name="referrer" content="unsafe-url">
<title>FAMAFAMI MADE</title>
<meta name="description" content="${OG.desc}">
<!-- 링크를 보냈을 때 뜨는 미리보기 [대표, 2026-08-11]. 이 태그가 없으면 카카오톡이
     「여기를 눌러 링크를 확인하세요」라는 제 기본 문구만 보여주고 사진이 안 뜬다.
     ★ 주소는 **반드시 https:// 부터 통째로** 적는다. assets/og.jpg 처럼 짧게 적으면
       카카오 서버가 어디서 받아야 할지 몰라 그림이 빠진다.
     ★ 카카오는 한번 읽은 미리보기를 **한참 붙들고 있는다.** 고친 뒤에는
       developers.kakao.com/tool/clear/og 에서 이 주소를 넣어 캐시를 지워야 바뀐다. -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="FAMAFAMI">
<meta property="og:title" content="${OG.title}">
<meta property="og:description" content="${OG.desc}">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}${OG.image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="파마파미 침구">
<meta property="og:locale" content="ko_KR">
<!-- 카카오는 og: 만 보지만, 링크를 다른 데로 옮겨 붙일 수도 있어 함께 적어둔다. -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${OG.title}">
<meta name="twitter:description" content="${OG.desc}">
<meta name="twitter:image" content="${SITE}${OG.image}">
<style>
${fontCss}
 :root{--head:${FONT_HEAD}}
 /* 글자 크기 단계. 자리마다 숫자를 박지 않고 이 계단에서 골라 쓴다 —
    한 곳만 고쳐도 화면 전체의 크기 관계가 유지된다. [2026-08-07]
      t1 구역 제목 · t2 칸 제목 · t3 본문 · t4 곁말 · t5 아주 작은 라벨 */
 :root{--t1:16px;--t2:13.5px;--t3:12.5px;--t4:11.5px;--t5:10.5px}
 /* 색 [대표, 2026-08-06] — 바탕은 크림, 글자와 강조는 **브랜드 네이비 #16203d**.
    네이비는 로고 시트 색 띠의 절반을 차지하는 주색인데 그동안 한 번도 안 쓰고 있었다.
    --fg 하나만 네이비로 바꾸면 「고른 부위」 알약, 「다음」 단추, 단계 표시, 색칩 선택
    테두리가 **전부 따라온다** — 그 자리들이 모두 var(--fg) 를 배경으로 쓰기 때문이다.
    --card 는 크림보다 밝게 둔다. 카드까지 크림이면 팔레트의 흰색·크림 계열 색칩이
    바탕에 묻혀 안 보인다 (901 아몬드 밀크 #f1ebdb 같은 것). */
 /* 시그니처 버터 #f4ecb8 (직조라벨 SH-295 버터베이지) 는 **지금 안 쓴다.**
    주 단추에 칠해봤더니 네이비 쪽이 더 세련돼 보인다는 판단이었다 [대표, 2026-08-06].
    큰 면적으로 깔면 무르게 보이는 색이다. 다시 쓸 일이 있으면 좁은 자리에 쓸 것. */
 :root{--bg:#f3f0e9;--fg:#16203d;--mut:#636a7b;--line:#e2ddd1;--card:#fdfbf6;--soft:#eae5da;--bad:#a8261f}
 @media (prefers-color-scheme:dark){:root{--bg:#131a2a;--fg:#ece9e1;--mut:#98a0b2;--line:#28324a;--card:#1a2338;--soft:#1f293e;--bad:#ff9384}}
 :root[data-theme="dark"]{--bg:#131a2a;--fg:#ece9e1;--mut:#98a0b2;--line:#28324a;--card:#1a2338;--soft:#1f293e;--bad:#ff9384}
 :root[data-theme="light"]{--bg:#f3f0e9;--fg:#16203d;--mut:#636a7b;--line:#e2ddd1;--card:#fdfbf6;--soft:#eae5da;--bad:#a8261f}
 *{box-sizing:border-box}
 html,body{margin:0;padding:0}
 /* 아래를 하단 단추 높이만큼 비워 둔다. ④ 에서는 저장 단추가 한 줄 더 붙어 단추가
    높아지므로 **76px 로 박아두면 마지막 글이 단추 뒤로 숨는다.** 실제 높이를 재어
    --navh 에 넣는다(syncNavH). 자바스크립트가 늦게 돌 때를 위해 76px 를 기본값으로 둔다. */
 body{background:var(--bg);color:var(--fg);line-height:1.6;
  padding-bottom:calc(var(--navh, 76px) + 10px);
  font-family:${FONT_BODY};-webkit-font-smoothing:antialiased}
 .wrap{max-width:960px;margin:0 auto;padding:16px 14px 24px}

 header{margin-bottom:12px}
 h1{font-size:17px;font-weight:650;margin:0 0 2px;letter-spacing:-.01em}
 /* 머리글 아래 한 마디. 두 줄로 끊어 쓰므로 줄간을 조금 벌리고,
    어쩔 수 없이 더 넘어갈 때는 띄어쓰기에서 끊기게 한다. */
 .sub{font-size:var(--t3);color:var(--mut);margin:0;line-height:1.75;word-break:keep-all}

 /* 진행 표시 */
 .steps{display:flex;gap:6px;margin:14px 0 16px}
 .steps div{flex:1;font-size:11.5px;text-align:center;padding:7px 2px;border-radius:7px;
  background:var(--soft);color:var(--mut);border:1px solid transparent}
 .steps div[aria-current="true"]{background:var(--fg);color:var(--bg);font-weight:600}

 /* ① 디자인 = 브랜드 표지 [대표, 2026-08-06]
    사진이 가로로 꽉 차고, 그 아래끝에 **워드마크가 걸쳐 잘린다.** 양옆으로도 조금 넘겨
    자른다 — 로고를 통째로 앉히면 그냥 머리글이 되고, 잘라야 표지처럼 읽힌다. */
 .brand{margin:-16px -14px 0}                 /* .wrap 의 여백을 지워 가로로 꽉 채운다 */
 .bshot{position:relative;overflow:hidden;background:var(--soft)}
 .bshot img{display:block;width:100%;height:auto}
 /* 아래쪽만 살짝 어둡게 깐다. 크림색 워드마크가 크림색 이불 위를 지날 때 사라져서다.
    사진 전체를 어둡게 하면 침구 색이 탁해 보이므로 아래 절반에만 준다. */
 .bshot::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(to bottom,transparent 44%,rgba(18,24,40,.30) 74%,rgba(18,24,40,.56))}
 /* 워드마크는 늘 사진 위에 얹히므로 화면 밝기와 무관하게 밝은 색으로 고정한다.
    아래로 넘어간 부분은 overflow:hidden 이 잘라낸다 — 글자가 사진에 잠긴 모양이 된다.
    translateY 는 제 키 기준이라 사진 높이가 바뀌어도 잘리는 정도가 그대로다. */
 .bmark{position:absolute;left:-2%;bottom:0;width:104%;aspect-ratio:900/79;z-index:1;
  transform:translateY(22%);background:#f4f1ea;
  -webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-mode:alpha;mask-mode:alpha}
 .btext{padding:26px 22px 4px}
 .beye{font-size:10.5px;letter-spacing:.17em;color:var(--mut);text-align:center;margin:0 0 11px}
 /* 표지 문구 — 제목 Paperlogy Bold 700 / 본문 Pretendard Regular 400.
    폰으로 보고 세 가지를 고쳤다 [대표, 2026-08-06].
      · 자간 -0.04em 이 너무 좁아 답답했다 → 0 으로 푼다
      · 42~48px 은 폰에서 너무 컸다 → 아래 「어떤 침구를 만들까요?」(15px) 에 맞춘다
      · 줄과 줄이 붙어 있었다 → 줄간을 넓히고 두 덩어리 사이도 벌린다
    이제 표지 글이 다 15px 이다. 크기로 힘을 주는 대신 **여백으로 읽히게** 한 것이다. */
 /* 제목 두 줄은 한 문장처럼 붙어 읽혀야 해서 본문(2.3)보다 좁게 잡는다 [대표, 2026-08-06].
    글꼴이 다른 두 덩어리(Paperlogy 제목 / Pretendard 본문) 사이는 넉넉히 벌린다 —
    붙여두면 글꼴이 바뀐 것이 실수처럼 보인다. */
 .btit{font-family:var(--head);font-size:25px;font-weight:700;
  line-height:1.65;letter-spacing:0;text-align:center;margin:0 0 40px}
 .bbody{font-size:15px;line-height:2.3;color:var(--mut);text-align:center;margin:0 auto}
 /* 카드 위 구역 이름. 표지에서 도구로 넘어가는 자리를 표시한다 */
 .bsec{text-align:center;margin:34px 0 15px}
 /* 제목 아래 두 덩어리 — 설명 한 단, 그보다 한 단 작고 연한 보조 안내 한 단.
    아래 여백 숫자가 곧 다음 덩어리까지의 거리다 [대표, 2026-08-07]:
      DESIGN → 제목 4 · 제목 → 설명 15 · 설명 → 안내 15 · 안내 → 카드 30 */
 .dlead{text-align:center;font-size:13px;line-height:1.7;color:var(--fg);
  margin:0 0 15px;word-break:keep-all}
 .dsub{text-align:center;font-size:11.5px;line-height:1.65;color:var(--mut);
  margin:0 0 30px;word-break:keep-all}
 .bsec .k{display:block;font-size:16px;font-weight:650;letter-spacing:-.01em}
 .bsec .e{display:block;font-size:10px;letter-spacing:.17em;color:var(--mut);margin-bottom:4px}
 /* 폰에서는 **표지만 한 화면**에 담고, 상품 카드는 아래로 내린다 [대표, 2026-08-06].
    100svh 를 쓰는 것은 주소창이 접혔다 펴졌다 할 때 화면이 튀지 않게 하려는 것이다.
    76px 은 아래 고정 단추(.nav) 자리다.
    글은 사진 아래 남는 공간의 **가운데**에 놓는다 — 위에 붙여두면 아래가 휑하다. */
 /* 표지 맨 아래에 붙는 안내. 화살표가 천천히 움직여 「더 있다」를 알린다.
    넓은 화면에서는 카드가 이미 보이므로 감춘다.
    ★ 감추는 규칙을 미디어쿼리보다 **먼저** 써야 한다. 뒤에 쓰면 힘이 같아서
      나중 것이 이겨 폰에서도 안 보인다. */
 .bmore{display:none;align-items:center;justify-content:center;gap:6px;margin:0 auto 16px;
  padding:9px 14px;border:0;background:none;cursor:pointer;font-family:inherit;
  font-size:12px;color:var(--mut);letter-spacing:.01em}
 .bmore .a{font-size:13px;animation:bob 1.9s ease-in-out infinite}
 @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
 /* 움직임을 꺼둔 사람에게는 흔들지 않는다 */
 @media (prefers-reduced-motion:reduce){.bmore .a{animation:none}}
 @media (max-width:700px){
  .brand{min-height:calc(100vh - 76px);min-height:calc(100svh - 76px);display:flex;flex-direction:column}
  .brand .btext{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:26px}
  .bmore{display:flex}
 }

 /* 디자인 고르기 — 쇼핑몰 상품 목록처럼 사진 카드를 눌러 들어간다 [대표, 2026-08-06].
    카드 두 장은 같은 사진·같은 색이고 젖혀진 면만 다르다. 견주면 차이가 그것 하나로 보인다. */
 .cards{display:grid;grid-template-columns:1fr 1fr;gap:11px}
 /* ★ flex 세로쌓기 — display:block 이면 **글이 짧은 카드의 속이 가운데로 내려앉는다**
    [대표, 2026-08-10]. 두 카드는 grid 가 같은 키로 늘리는데, 단추는 속이 제 키보다
    작으면 브라우저가 저 혼자 가운데로 모은다(단추의 타고난 성질이다). 그래서 글이
    두 줄인 「날개 디자인」만 사진도 이름도 아래로 밀려 두 카드의 이름 줄이 어긋났다.
    세로쌓기로 바꾸면 속이 **위에서부터** 쌓인다 — 카드 키는 그대로 같고 이름 줄이 맞는다. */
 .cards button{display:flex;flex-direction:column;width:100%;padding:0;overflow:hidden;
  cursor:pointer;font-family:inherit;
  text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg)}
 /* flex 칸이 되었으니 줄어들지 않게 못박는다. 안 그러면 카드가 좁을 때 사진만 눌린다. */
 .cards button img{display:block;width:100%;aspect-ratio:1;object-fit:cover;flex:0 0 auto}
 /* 두 카드의 안쪽 여백을 똑같이 둔다. 글 길이가 달라도 칸 높이는 grid 가 맞춰준다. */
 .cards .ct{display:block;padding:11px 12px 13px;position:relative}
 /* 카드 제목만 Paperlogy [대표, 2026-08-07]. 표지 제목과 같은 글꼴이라 이름끼리 묶여 보인다.
    심어둔 Paperlogy 는 **굵기 700 한 벌뿐**이라 700 으로 못박는다 — 650 을 주면
    브라우저가 억지로 굵기를 만들어내(가짜 굵게) 획이 뭉개진다. */
 .cards .cn{display:block;font-family:var(--head);font-size:15px;font-weight:700;
  line-height:1.4;margin-bottom:3px}
 .cards .cd{display:block;font-size:11.5px;color:var(--mut);line-height:1.5;word-break:keep-all}
 /* 아주 좁은 폰에서만 한 단 내린다 [2026-08-10]. 「양면 다른 컬러 선택 가능)」은
    11.5px 로 115px 인데 320px 폰의 카드에는 114.5px 밖에 없다 — 0.5px 가 모자라
    한 줄이 두 줄로 갈린다. 11px 면 110px 이라 들어간다. 360px 부터는 134px 이 있어
    손댈 것이 없다. */
 @media (max-width:340px){ .cards .cd{font-size:11px} }
 .cards button[aria-pressed="true"]{border-color:var(--fg);box-shadow:0 0 0 1.5px var(--fg)}
 /* 「고르신 것」 자리는 **늘 잡아둔다.** display 로 껐다 켜면 고른 카드만 키가 커져
    두 카드 높이가 어긋나고, 누를 때마다 화면이 덜컥 움직인다. */
 .cards .cnow{display:block;visibility:hidden;font-size:10.5px;font-weight:650;
  color:var(--bg);background:var(--fg);border-radius:999px;padding:2px 8px;
  margin-top:7px;width:fit-content}
 .cards button[aria-pressed="true"] .cnow{visibility:visible}
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

 /* 베개커버를 양면으로 할지 묻던 체크칸. **지금은 그 칸이 없습니다** [대표, 2026-08-07] —
    「다른 컬러」면 베개커버도 무조건 양면입니다. 되살릴 때 쓰려고 남겨둡니다. */
 .ptwo{display:flex;align-items:flex-start;gap:9px;margin:0 0 11px;padding:10px 12px;
  border:1px solid var(--line);border-radius:9px;background:var(--card);
  font-size:11.5px;color:var(--mut);line-height:1.55;cursor:pointer}
 .ptwo[hidden]{display:none}
 .ptwo input{width:18px;height:18px;accent-color:var(--fg);flex:none;margin-top:1px}
 .ptwo b{color:var(--fg);font-size:12.5px;font-weight:650}

 /* 부위 · 팔레트 */
 .parts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
 /* 폰에서는 **두 칸씩** 줄을 맞춘다 [대표, 2026-08-07].
    넓은 화면에서는 한 줄에 다 들어가는데, 폰에서는 알아서 접히느라 3개·2개·1개 처럼
    들쭉날쭉해져 무엇이 몇 개인지 한눈에 안 들어왔다. */
 @media (max-width:700px){
  .parts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
  /* 칸 폭이 정해지니 좌우 여백을 줄여 긴 이름(베개(앞)-오른쪽)이 들어갈 자리를 번다.
     줄임표(…)는 쓰지 않는다 — 눌러야 할 단추의 이름이 잘리면 무엇인지 알 수 없다. */
  .part{padding:7px 8px;white-space:nowrap}
 }
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
 /* 색칩 위 안내. 고를 것을 가리지 않게 곁말 크기로 두되, 바탕을 한 칸 깔아 그냥
    지나치지 않게 한다. 줄바꿈은 HTML 에 손으로 넣으므로 저절로 넘기지 않는다. */
 .disc{font-size:var(--t5);color:var(--mut);line-height:1.7;word-break:keep-all;
  margin:0 0 11px;padding:9px 11px;background:var(--soft);border-radius:9px}
 .gname{font-size:11px;color:var(--mut);margin:14px 0 7px}
 /* 칩 밑에 번수(위)와 원단 번호(아래)를 적는다. 컬러명은 넣지 않는다 —
    한글명이 「라이트 스킨 베이지」처럼 길어 이 폭에서는 잘려서 오히려 못 읽는다.
    이름은 칩을 누르면 위쪽 큰 칸에 나오고, 마우스를 올려도 나온다. [대표, 2026-08-05] */
 .sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:10px 7px}
 .sw button{border:0;background:none;padding:0;cursor:pointer;font-family:inherit;
  display:flex;flex-direction:column;gap:3px;text-align:center}
 /* 팔레트는 카드가 아니라 크림 바탕 위에 바로 놓인다. 흰색·크림 계열 칩(952·902·2002…)이
    바탕과 가까워서 테두리가 유일한 구분선이다 — 옅게 두면 칩이 안 보인다. */
 .sw button .c{display:block;aspect-ratio:1;border-radius:8px;border:1px solid rgba(0,0,0,.18)}
 .sw button .n{font-size:10px;line-height:1.15;color:var(--fg);letter-spacing:-.3px}
 /* 번수는 매트리스커버에서 고를 수 있는지를 가르는 값이라 흐리면 안 된다 [대표, 2026-08-05] */
 .sw button .s{font-size:10px;line-height:1.15;color:var(--fg);font-weight:600}
 .sw button[aria-current="true"] .c{box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--fg)}
 .sw button[aria-current="true"] .n{font-weight:700}

 /* 입력 */
 /* 칸 안팎을 넉넉히 — 빽빽한 주문서가 아니라 하나씩 골라가는 자리로 보이게 [대표, 2026-08-07] */
 .card{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:17px 15px;margin-bottom:14px}
 .card h2{font-size:var(--t2);font-weight:650;margin:0 0 9px}
 /* 안내글은 **한 문장에 한 줄**이다 (본문에 <br> 로 끊어둔다). 그래도 한 줄이 화면보다
    길면 넘어가는데, keep-all 을 걸어 낱말 가운데가 아니라 띄어쓰기에서 끊기게 한다. */
 .card p.d{font-size:var(--t4);color:var(--mut);margin:0 0 11px;line-height:1.75;word-break:keep-all}
 /* ③ 칸의 안내 — 제목 밑에 한 덩어리로 묶고, 고르는 칸까지 넉넉히 띄운다.
    lead 는 눈에 먼저 들어오는 말, sub 는 한 단 작고 연한 곁말이다.
    크기는 숫자로 박지 않고 :root 에 정해둔 단계(--t3/--t4)를 쓴다. */
 .say{margin:0 0 20px}
 .say p{margin:0 0 9px;line-height:1.75;word-break:keep-all}
 .say p:last-child{margin-bottom:0}
 .say .lead{font-size:var(--t3);color:var(--fg)}
 .say .sub{font-size:var(--t4);color:var(--mut)}
 .say p:empty{display:none}          /* 고른 것에 따라 비는 줄이 여백만 남기지 않게 */

 /* 접어두는 안내 — 평소엔 한 줄로 접혀 있다가 눌러야 펴진다 */
 .fold{margin:-6px 0 20px}
 .fold summary{display:inline-flex;align-items:center;gap:5px;cursor:pointer;
  font-size:var(--t4);color:var(--mut);padding:6px 0;list-style:none}
 .fold summary::-webkit-details-marker{display:none}
 .fold summary::after{content:'▾';font-size:.95em;line-height:1;transition:transform .15s}
 .fold[open] summary::after{transform:rotate(180deg)}
 .fold .fb{font-size:var(--t4);color:var(--mut);line-height:1.95;margin:2px 0 0;
  padding:11px 13px;background:var(--soft);border-radius:9px;word-break:keep-all}
 .fold .fb b{color:var(--fg);font-weight:650}
 /* 설명 없는 칸 — 제목 밑 여백을 설명이 차지하던 만큼 벌린다 */
 .card.bare h2{margin-bottom:11px}
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
 /* 합계 아래 안내. **합계보다 한 단계 낮게** — 크기도 색도 낮춰 금액이 먼저 읽히게 한다.
    문장이 끝나는 자리에서 <br> 로 손수 끊고, 그래도 넘칠 때는 keep-all 로 띄어쓰기에서
    갈라지게 둔다. 넓은 화면이라고 한 줄로 늘이지 않는다 [대표, 2026-08-07] */
 .qfoot{font-size:var(--t4);color:var(--mut);margin:10px 0 0;line-height:1.7;word-break:keep-all}
 /* 진하게 쓰던 「결제 링크를 보내드립니다」를 이 카드에서 뺐으므로(주문 방법 안내가
    같은 말을 한다) .qfoot b 규칙도 함께 걷어냈다 [대표, 2026-08-11].
    다시 진한 말을 넣을 일이 생기면 .ordnote b 를 그대로 베끼면 된다 — 본문 글꼴은
    400 한 벌뿐이라 <b> 만으로는 브라우저가 억지로 굵게 그려 흐릿하게 번진다. */
 /* 이쪽은 **그 주문에만 뜨는 말**이다 (주문 불가, 앞뒤가 같은 색 …). 없으면 통째로 감춘다. */
 .qnote{font-size:var(--t4);color:var(--mut);margin:7px 0 0;line-height:1.65;word-break:keep-all}

 /* 확인 */
 pre{margin:0 0 10px;padding:13px;background:var(--card);border:1px solid var(--line);border-radius:9px;
  font-size:12.5px;line-height:1.85;white-space:pre-wrap;word-break:break-word;
  font-family:ui-monospace,SFMono-Regular,Menlo,"D2Coding",monospace}
 /* 줄이 길어 꺾이면 **꺾인 줄을 들여쓴다** (매달린 들여쓰기) [대표, 2026-08-10].
    글자를 줄여 대부분 한 줄에 담기게 했지만, 손님이 고른 색 이름이 길면 여전히 꺾인다.
    그때 꺾인 줄이 왼쪽 끝에서 시작하면 새 항목처럼 보인다.
    ★ 줄마다 블록이라야 걸린다 — pre 하나에 걸면 **글 전체의 첫 줄**에만 먹는다. */
 .ol{display:block;padding-left:2.8em;text-indent:-2.8em}
 /* 좁은 폰(아이폰 SE 320px 등)에서는 한 단계 줄인다. 고정폭 글꼴이라 한글 한 자가
    넓어서, 색 이름이 긴 줄이 이 폭에서만 넘친다. 글자를 줄이는 편이 줄을 꺾는 것보다 낫다. */
 @media (max-width:380px){ pre{font-size:11px;padding:11px 10px} }
 /* keep-all — 줄이 꺾일 때 **낱말 가운데를 자르지 않는다.**
    이게 없으면 폰에서 「카카오톡이 열 / 립니다」처럼 잘려 읽다가 걸린다. */
 .ordnote{font-size:11.5px;color:var(--mut);margin:0;line-height:1.7;word-break:keep-all}
 /* 손님이 **눌러야 할 것**과 **해야 할 일**만 굵게 [대표, 2026-08-10].
    ★ 본문 글꼴(FF Body)은 400 한 벌뿐이라 <b> 만으로는 브라우저가 억지로 굵게 그려
      흐릿하게 번진다. 진짜 굵은 벌이 있는 제목 글꼴(FF Head 700)로 바꿔 그린다.
      글자색도 곁말 회색에서 본문 네이비로 올려야 눈에 든다 — 굵기만으로는 약하다. */
 /* 굵게 쓴 토막은 **통째로 한 덩어리**다 — 「카톡으로 / 주문하기」로 갈라지면 단추 이름으로
    안 읽힌다. 눈이 단추를 찾아야 하니 이름은 붙어 있어야 한다. */
 .ordnote b{font-family:var(--head);font-weight:700;color:var(--fg);white-space:nowrap}

 /* 위 문장을 **한 줄로 줄여 그린 것**이다 [대표, 2026-08-10]. 문장은 읽어야 알고
    이 띠는 보면 안다 — 넷을 거쳐 끝난다는 것이 눈에 먼저 들어온다.
    ★ 그러니 여기에는 **새 내용이 없어야 한다.** 위에 없는 말이 여기서 처음 나오면
      손님은 두 곳을 다 읽어야 한다. 줄인 말이라 자체로는 뜻이 다 안 선다. */
 /* 왼쪽 정렬 [대표, 2026-08-10]. 위 문장들이 왼쪽에서 시작하므로 띠도 같은 자리에서
    시작해야 한 덩어리로 읽힌다 — 가운데로 모으면 띠만 따로 떠 보인다.
    ★ 띠 자체에는 바탕을 깔지 않는다. 박스는 이제 **토막마다** 있다. 둘 다 깔면
      상자 안의 상자가 되어 어느 쪽이 눌러야 할 것인지 흐려진다. */
 .flow{display:flex;align-items:center;justify-content:flex-start;gap:4px;margin:4px 0 0}
 /* 띠 아래에서 걸음을 풀어 주는 문장. 띠에 바로 붙으면 띠의 일부처럼 보인다. */
 .ordnote.flowtext{margin-top:12px}
 /* 토막은 **꺾이지 않는다.** 「붙여 / 넣기」로 갈라지면 한눈에 보는 값이 사라진다.
    대신 좁으면 글자와 여백이 함께 줄어든다 — 320px 에서도 넉 토막이 한 줄에 남는다.
    바탕은 종이보다 한 단 진한 회색(--soft)에 테두리(--line) 한 줄. 진하게만 해서는
    박스로 안 보이고, 더 진하게 하면 아래 단추보다 세져 눈을 먼저 끈다. */
 .flow span{font-family:var(--head);font-weight:700;color:var(--fg);
  font-size:var(--t5);white-space:nowrap;
  background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:5px 7px}
 /* 화살표는 **곁말 색**이다. 토막보다 앞에 나서면 안 된다 — 이어진다는 표시일 뿐이다.
    ★ 글꼴을 기기 것으로 둔다. 잘라 심은 두 벌에 → 가 있다는 보장이 없는데, 없으면
      네모(豆腐)로 뜬다. 글자가 아니라 기호라 기기 글꼴로 그려도 티가 안 난다. */
 .flow i{color:var(--mut);font-size:var(--t5);font-style:normal;flex:0 0 auto;
  font-family:system-ui,-apple-system,"Segoe UI Symbol",sans-serif}
 @media (max-width:360px){ .flow{gap:2px}
  .flow span{font-size:9.5px;padding:4px 5px} .flow i{font-size:9.5px} }
 /* 색상 안내는 **딴 이야기**다. 전에는 <br><br> 로 띄웠는데, 사이에 띠가 들어오면서
    문단이 갈렸다 — 이제 그 자리를 margin 이 맡는다. 띠가 없는 경우(문의처 미설정)에도
    같은 만큼 떨어져야 하므로 띠가 아니라 이 문단에 건다. */
 .ordnote.tail{margin-top:13px}

 /* 하단 고정 이동 */
 /* 세로쌓기 — ④ 에서 저장 단추가 「카톡으로 주문하기」 **위에** 한 줄로 붙는다. */
 .nav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--bg);
  border-top:1px solid var(--line);padding:11px 14px calc(11px + env(safe-area-inset-bottom));
  display:flex;flex-direction:column;gap:9px;max-width:960px;margin:0 auto}
 .navrow{display:flex;gap:9px}
 .nav button{padding:14px;border-radius:9px;font-size:14px;font-weight:600;
  cursor:pointer;font-family:inherit;border:1px solid var(--fg)}
 .navrow button{flex:1}
 .nav .prev{background:transparent;color:var(--fg);flex:0 0 92px}
 .nav .next{background:var(--fg);color:var(--bg)}
 /* 저장은 **곁일**이다 [대표, 2026-08-10]. 크기와 모양은 아래 단추와 같게 두되
    속을 비워 테두리만 남긴다 — 진한 단추가 둘이면 눌러야 할 것이 어느 쪽인지
    흐려지고, 주문으로 가는 길이 약해진다. 「이전」과 같은 결이다. */
 .nav .save{background:transparent;color:var(--fg);width:100%}
 .nav .save:disabled{opacity:.55;cursor:default}
 .nav button[hidden]{display:none}

 /* 카톡으로 넘어가기 직전에 뜨는 알림. **하단 단추 바로 위에 붙여 고정한다** — 어디를 보고 계시든
    눈에 들어와야 한다. ④ 글 사이에 끼워두면 스크롤 위치에 따라 안 보인다.
    카톡으로 넘어간 뒤에도 남아 있어, 돌아오셨을 때 무엇을 하던 중이었는지 알 수 있다. */
 /* --navh 는 하단 단추의 **잰 높이**다(안전영역까지 들어 있다). ④ 에서 저장 단추가
    붙어 단추가 높아지면 알림도 같이 올라와야 겹치지 않는다. */
 .toast{position:fixed;left:12px;right:12px;bottom:calc(var(--navh, 76px) + 8px);
  z-index:30;max-width:936px;margin:0 auto;padding:12px 14px;border-radius:10px;
  background:var(--fg);color:var(--bg);font-size:var(--t4);line-height:1.65;
  word-break:keep-all;box-shadow:0 6px 20px rgba(0,0,0,.18)}
 .toast[hidden]{display:none}
 .toast b{display:block;font-size:var(--t3);font-weight:650;margin-bottom:2px}
 /* 카톡이 안 열렸을 때 손수 누를 자리. 늘 보이지만 작게 둔다. */
 .toast a{display:inline-block;margin-top:6px;color:inherit;opacity:.8}
</style>
</head><body>

<div class="wrap">
<!-- 머리글과 단계 표시는 ① 디자인에서 감춘다. 첫 화면은 표지고, 카드를 누르면 도구가 된다. -->
<div id="topbar">
<header>
  <!-- 페이지 이름 [대표, 2026-08-07]. 「컬러 시뮬레이터」는 만드는 쪽 말이라
       손님에게는 뜻이 안 통한다. 브라우저 탭·즐겨찾기에도 이 이름으로 뜬다. -->
  <h1>FAMAFAMI MADE</h1>
  <p class="sub" id="sub"></p>
</header>

<div class="steps">
  <div data-s="0" aria-current="true">① 디자인</div>
  <div data-s="1">② 색</div>
  <div data-s="2">③ 사이즈</div>
  <div data-s="3">④ 확인</div>
</div>
</div>

<!-- ① 디자인 -->
<section class="step" data-step="0" aria-hidden="false">
  <div class="brand">
    <div class="bshot">
      <img src="${b64('hero.jpg','image/jpeg')}" alt="파마파미 침구">
      <span class="bmark" role="img" aria-label="FAMA FAMI"
        style="-webkit-mask-image:url('${b64('logo.png','image/png')}');mask-image:url('${b64('logo.png','image/png')}')"></span>
    </div>
    <div class="btext">
      <p class="beye">${BRAND.eyebrow}</p>
      <h2 class="btit">${BRAND.title.join('<br>')}</h2>
      <p class="bbody">${BRAND.body.join('<br>')}</p>
    </div>
    <!-- 폰에서는 표지가 한 화면을 다 채워 카드가 안 보인다. 아래에 더 있다는 것을 알린다 —
         없으면 아래 「색 고르기」를 그냥 눌러 기본 디자인(무지)으로 넘어간다. -->
    <button class="bmore" id="bmore">디자인 고르기<span class="a">↓</span></button>
  </div>
  <p class="bsec"><span class="e">DESIGN</span><span class="k">어떤 침구를 만들까요?</span></p>
  <!-- 줄바꿈은 대표가 정한 자리다 [2026-08-07]. word-break:keep-all 을 걸어두어
       좁은 화면에서 어쩔 수 없이 넘어갈 때도 낱말 가운데가 아니라 띄어쓰기에서 끊긴다. -->
  <p class="dlead">이불부터 베개커버, 매트리스커버까지<br>하나의 공간처럼 함께 만들어보세요.</p>
  <p class="dsub">매트리스커버는 우리 집 침대에 맞게<br>사이즈 맞춤이 가능합니다.</p>
  <div class="cards" id="designs">
${DESIGNS.map((d,i)=>`    <button data-design="${d.key}" aria-pressed="${i===0}">
      <img src="${b64(d.card,'image/jpeg')}" alt="${d.ko} 미리보기">
      <span class="ct"><span class="cn">${d.ko}</span><span class="cd">${d.cd.join('<br>')}</span><span class="cnow">고르신 것</span></span>
    </button>`).join('\n')}
  </div>
  <!-- 줄바꿈은 대표가 정한 자리다 [2026-08-06]. 저절로 넘어가게 두지 말 것. -->
  <p class="chint">사진은 예시입니다.<br>
    당신의 취향에 맞게, 하나씩 바꿔보세요.</p>
</section>

<!-- ② 색 -->
<section class="step" data-step="1" aria-hidden="true">
  <div class="dnow">
    <span><b id="dnowT"></b> · <span id="dnowD"></span></span>
    <button type="button" id="dchg">디자인 바꾸기</button>
  </div>
  <div class="scenebox" id="sceneMain">
${DESIGNS.map(d=>{const z=imgSize(d.base);return `    <div class="scene" data-design="${d.key}"${d.key===DESIGNS[0].key?'':' hidden'}>
      <img data-src="${ext(d.base)}" width="${z.w}" height="${z.h}" alt="${d.ko} 미리보기">
${PARTS.filter(p=>inDz(p,d.key)).map(p=>`      <div class="layer" data-part="${p.key}" data-mask="${ext(maskOf(p))}" style="background-color:${p.def}"></div>`).join('\n')}
    </div>`;}).join('\n')}
  </div>
  <!-- 「베개커버도 앞뒤를 다르게」 체크칸은 없앴다 [대표, 2026-08-07].
       「다른 컬러」를 고르셨으면 베개커버도 **무조건 양면**이다. 물을 것이 없어졌다.
       되살리려면 이 자리에 체크칸을 두고 pilTwo() 를 그 값에 다시 묶으면 된다. -->
  <div class="parts">
${PARTS.filter(pickable).map(p=>`    <button class="part" data-part="${p.key}" aria-pressed="false"><span class="dot" style="background:${p.def}"></span>${p.ko}</button>`).join('\n')}
  </div>
  <div class="now">
    <span class="big" id="nowSw"></span>
    <span><span class="l1" id="nowL1">-</span><br><span class="l2" id="nowL2">-</span></span>
  </div>
  <!-- 색칩 바로 위에 둔다 [대표, 2026-08-10]. 손님이 **색을 고르기 직전에** 읽어야
       하는 말이라, 화면 아래쪽이나 ④ 확인에 두면 이미 다 고른 뒤가 된다.
       ★ 줄바꿈은 손으로 넣는다 [대표, 2026-08-10] — 폰에서 저절로 넘어가게 두면
         「사용하시는 기기와 화면 설」 처럼 말 중간이 끊겨 읽기 나쁘다.
         한 줄을 20자 안쪽으로 끊어 뜻 단위로 넘긴다. 문구를 고치면 이 자리도 다시 볼 것. -->
  <p class="disc" id="palDisc">
    화면의 컬러는 참고용입니다.<br>
    사용하시는 기기와 화면 설정에 따라<br>
    다르게 보일 수 있으며,<br>
    실제 원단 컬러와 차이가 있을 수 있습니다.
  </p>
  <p class="hint" id="palHint"></p>
  <div id="palette"></div>
</section>

<!-- ③ 사이즈 -->
<section class="step" data-step="2" aria-hidden="true">
  <!-- ③ 은 「옵션 고르는 폼」이 아니라 **하나씩 완성해가는 자리**로 읽혀야 한다
       [대표, 2026-08-07]. 그래서 칸마다 짜임을 똑같이 맞췄다:
         제목 → 경험형 안내(lead) → 보조 안내(sub) → 고르는 칸 → 제외 체크
       줄바꿈은 **뜻이 끊기는 자리**에 손으로 넣는다. 넓은 화면이라고 한 줄로 길게
       늘이지 않는다 — 폰과 같은 호흡으로 읽히는 편이 낫다. -->
  <div class="card">
    <h2>이불 선택</h2>
    <div class="say">
      <p class="lead">원하는 계절감에 맞춰<br>선택해보세요.</p>
      <p class="sub">차렵이불은 두께를 선택할 수 있고,<br>이불커버는 커버만 제작됩니다.</p>
    </div>
    <div id="grpQuilt">
      <div class="fld"><label>종류</label><select id="q_kind">${QUILT_KIND.map((k,i)=>`<option value="${k.key}"${i===0?' selected':''}>${k.ko}</option>`).join('')}</select></div>
      <div class="fld"><label>사이즈</label><select id="q_size"></select></div>
      <div class="fld" id="q_ozFld"><label>두께</label><select id="q_oz">${OZ.map(o=>`<option${o==='간절기용 (8온스)'?' selected':''}>${o}</option>`).join('')}</select></div>
      <div class="fld" id="q_snapFld"><label>이불 연결 똑딱이 갯수</label>
        <input id="q_snap" type="text" inputmode="numeric" placeholder="예: 8"></div>
      <div class="fld"><label>수량</label><select id="q_qty">${ITEM_QTY.map(n=>`<option value="${n}">${n}장</option>`).join('')}</select></div>
    </div>
    <label class="skip"><input type="checkbox" id="q_skip"> 이불 제외</label>
  </div>

  <div class="card">
    <h2>매트리스커버 선택</h2>
    <div class="say">
      <p class="lead">우리 집 매트리스 크기에 맞게<br>제작됩니다.</p>
      <p class="sub">침대 프레임이 아닌<br>매트리스 실제 사이즈를 입력해주세요.</p>
${HT.length ? `      <p class="sub">높이에 따라 추가 비용이<br>자동으로 적용됩니다.</p>` : ''}
    </div>
${HT.length ? `    <!-- 높이별 금액은 지우지 않고 접어둔다 [대표, 2026-08-07]. 대부분은 볼 일이 없지만
         높은 매트리스를 쓰는 분에게는 값이 걸린 정보라 없애면 안 된다. -->
    <details class="fold">
      <summary>높이 안내</summary>
      <p class="fb">${HT_LINES}<br><b>높이 ${H_MAX}cm까지만 주문받습니다.</b></p>
    </details>` : ''}
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
    <label class="skip"><input type="checkbox" id="m_skip"> 매트리스커버 제외</label>
  </div>

  <div class="card">
    <h2>베개커버 선택</h2>
    <div class="say">
      <p class="lead">원하는 색상과 사이즈를<br>선택해주세요.</p>
      <p class="sub">사용 중인 베개 사이즈를<br>선택하시면 됩니다.</p>
      <p class="sub">목록에 없는 사이즈는<br>요청사항에 남겨주세요.</p>
      <!-- 고른 디자인에 따라 달라지는 말만 여기에 넣는다. 화면 구조를 설명하는 말
           (「②에서 고르신 4칸이…」)은 뺐다 — 손님이 알 바가 아니다. -->
      <p class="sub" id="pDesc"></p>
    </div>
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
    <label class="skip"><input type="checkbox" id="p_skip"> 베개커버 제외</label>
  </div>

  <!-- 예시도 설명도 적어두지 않는다 [대표, 2026-08-06]. 자유롭게 적으시라는 칸에 보기나
       설명을 걸어두면 손님이 그 틀에 맞춰 적게 된다. 비워두면 하고 싶은 말을 그대로 적으신다.
       칸 이름이 제목뿐이라 읽어주는 기계를 위해 aria-label 을 남긴다. -->
  <!-- 「요청사항」으로 부른다 [대표, 2026-08-07]. 베개커버 안내에서 「요청사항에
       남겨주세요」라고 가리키므로, 그 이름이 화면에 실제로 있어야 찾아간다. -->
  <div class="card bare">
    <h2>요청사항</h2>
    <div class="fld"><input id="memo" type="text" aria-label="요청사항"></div>
  </div>
</section>

<!-- ④ 확인 -->
<section class="step" data-step="3" aria-hidden="true">
  <div class="scenebox mini" id="sceneMini"></div>
${PRICE_READY ? `  <div class="card">
    <!-- 「예상」이 아니라 「견적」이다 [대표, 2026-08-11]. 예상이라고 하면 뒤에 값이
         바뀔 수 있는 것처럼 읽힌다. 고른 옵션으로 셈이 끝난 값이므로 견적이 맞다. -->
    <h2>견적 금액</h2>
    <div id="qRows"></div>
    <div class="qsum" id="qSumBox"><span>합계</span><b id="qSum">-</b></div>
    <!-- 이 카드는 **얼마인지만** 말한다 [대표, 2026-08-11]. 결제 링크 이야기는 아래
         주문 방법 안내가 「확인 후 결제하실 수 있는 링크를 보내드립니다」로 하고 있어,
         여기에도 적었더니 한 화면에 같은 말이 두 번 나왔다. 다음에 무슨 일이
         생기는지는 **주문 방법 쪽 한 곳에서만** 말한다. -->
    <p class="qfoot">선택하신 옵션을 기준으로 계산된 견적 금액입니다.</p>
    <p class="qnote" id="qNote"></p>
  </div>
` : ''}  <pre id="orderTxt"></pre>
  <!-- 주문은 **이미지 두 장을 첨부하는 방식**이다 [대표, 2026-08-10]. 전에는 주문
       내용을 클립보드에 복사해 채팅창에 붙여넣게 했는데, 이제 저장 단추가 침구
       사진과 주문 내역을 그림으로 만들어 주므로 손님은 그 두 장을 붙이면 된다.
       ★ 띠가 **먼저** 온다. 세 걸음이라는 것을 읽기 전에 보게 하고, 그 아래 문장이
         걸음마다 무엇을 하는지 풀어 준다.
       ★ <div> 는 <p> 안에 못 들어간다 — 넣으면 브라우저가 문단을 제멋대로 닫아
         뒤따르는 글이 문단 밖으로 밀린다. 그래서 띠를 문단 밖에 둔다. -->
  <div class="flow" aria-hidden="true">
    <span>내 침구 저장하기</span><i>→</i><span>카톡으로 주문하기</span><i>→</i><span>이미지 2장 첨부</span>
  </div>
  <!-- 한 문장에 한 줄 — 넓은 화면이라고 이어 붙이지 않는다 [대표, 2026-08-07].
       폰에서 꺾이는 자리를 브라우저에 맡기면 말 가운데가 잘리므로, **뜻이 끊기는
       자리마다 우리가 먼저 줄을 바꾼다.** 걸음 사이는 빈 줄로 띄워 두 덩어리가
       갈려 보이게 한다 — 무엇을 먼저 하고 무엇을 나중에 하는지가 그것으로 읽힌다. -->
  <p class="ordnote flowtext">
    <b>「내 침구 저장하기」</b>를 누르면<br>
    완성한 침구 이미지와 주문 내역이 함께 저장됩니다.<br><br>
    <b>「카톡으로 주문하기」</b>를 누른 후<br>
    저장된 <b>이미지 2장</b>을 채팅창에 첨부해주세요.<br><br>
    확인 후 결제하실 수 있는 링크를 보내드립니다.
  </p>
  <p class="ordnote tail">
    화면에서 보이는 색상과 실제 원단의 색상은 차이가 있을 수 있습니다.
  </p>
</section>
</div>

<!-- 저장 단추는 ④ 에서만 뜬다 [대표, 2026-08-10]. 앞 단계에서는 아직 고르는 중이라
     저장할 것이 없고, 자리만 차지해 「다음」을 밀어낸다. -->
<div class="nav">
  <button class="save" id="btnSave" type="button" hidden>내 침구 저장하기</button>
  <div class="navrow">
    <button class="prev" id="btnPrev" hidden>이전</button>
    <button class="next" id="btnNext"></button>
  </div>
</div>
${INQUIRY ? `<!-- 카톡으로 넘어가기 직전에 뜬다. 넘어간 뒤에도 남아 있어 돌아오시면
     무엇을 하던 중이었는지 그대로 보인다 — 첨부는 채팅창에서 해야 하는 일이라
     이 한 줄이 없으면 채팅창을 열어놓고 무엇을 할지 모른 채 서게 된다. -->
<div class="toast" id="toast" hidden role="status">
  <b>✓ 이미지 2장이 저장되어 있습니다.</b>
  카카오톡 채팅창에 두 장을 첨부해 보내주세요.
  <a href="${INQUIRY}" target="_blank" rel="noopener">카카오톡이 안 열렸다면 여기를 눌러주세요</a>
</div>` : ''}

<script>
const SW = ${JSON.stringify(SW)};
const PARTS = ${JSON.stringify(PARTS)};
const DESIGNS = ${JSON.stringify(DESIGNS)};
const CARRY = ${JSON.stringify(CARRY)};
const PIL_MODES = ${JSON.stringify(PIL_MODES)};
const TOTAL = ${total};
const PRICE = ${JSON.stringify(PRICE)};
const ALWAYS_CUSTOM = ${ALWAYS_CUSTOM};
const INQUIRY = ${JSON.stringify(INQUIRY)};
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
// ① 의 단추만 「내 침구 만들기」다 [대표, 2026-08-06] — 표지에서 시작을 누르는 자리라
// 하는 일(색 고르기)보다 **무엇을 얻는지**를 적는다. 뒤 단계는 그대로 하는 일을 적는다.
// 마지막 단추는 늘 「카톡으로 주문하기」다 [대표, 2026-08-10]. 채널 주소가 비면
// 빌드가 멈추므로(위 INQUIRY 확인) 눌렀는데 안 열리는 일은 없다.
const NEXT_LABEL = ['내 침구 만들기','사이즈 입력하기','확인하기','카톡으로 주문하기'];
const LAST = NEXT_LABEL.length - 1;
function goto(s){
  step = s;
  // ① 은 브랜드 표지다. 머리글과 단계 표시를 걷어내야 사진이 화면 맨 위에서 시작한다.
  $('#topbar').hidden = s === 0;
  $$('.step').forEach(el => el.setAttribute('aria-hidden', +el.dataset.step !== s));
  $$('.steps div').forEach(el => el.setAttribute('aria-current', +el.dataset.s === s));
  $('#btnPrev').hidden = s === 0;
  $('#btnNext').textContent = NEXT_LABEL[s];
  if (s === 2) { renderPillows(); checkHeight(); }
  if (s === 3) { buildMini(); renderQuote(); renderOrder(); }
  // 저장 단추는 ④ 에서만. 뜨고 지는 만큼 단추 높이가 달라지므로 곧바로 다시 잰다.
  saveShow(s === LAST);
  // 단계를 옮기면 알림을 지운다. ④ 를 벗어난 뒤에도 떠 있으면 고른 것을 고치는
  // 중인데 「첨부해 보내주세요」가 남아 이미 보낸 것처럼 보인다.
  if (INQUIRY) $('#toast').hidden = true;
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
  // 카드를 안 누르고 아래 단추로 넘어가면 지금 디자인(무지)으로 정해진 것으로 본다.
  // 안 그러면 ② 는 무지인데 ① 로 돌아왔을 때 아무것도 안 골라진 것처럼 보인다.
  if (step === 0) { chosen = true; markCards(); }
  // ③ → ④ 는 매트리스 실제 치수가 다 적혀야 넘어간다 [대표, 2026-08-07].
  // 막을 때는 **어디를 적어야 하는지 보여주고 커서까지 옮긴다** — 못 넘어간다는 것만
  // 알리고 손님이 알아서 찾게 두면 어느 칸인지 몰라 헤맨다.
  if (step === 2) {
    const miss = matMissing();
    if (miss.length) {
      matTried = true;
      checkHeight();
      const first = $('#' + miss[0][0]);
      first.scrollIntoView({ behavior:'smooth', block:'center' });
      first.focus({ preventScroll:true });
      return;
    }
  }
  if (step < LAST) return navigate(step+1);
  // 마지막 단추가 하는 일은 **채팅방을 여는 것 하나**다 [대표, 2026-08-10].
  // 주문 내용을 클립보드에 복사하던 일은 없앴다 — 이제 저장 단추가 만들어 준
  // 이미지 두 장을 손님이 채팅창에 첨부한다. 붙여넣을 글이 없으니 복사할 것도 없다.
  //   ★ 알림을 **먼저 띄우고 잠깐 뒤에** 넘어간다. 바로 넘어가면 알림이 보일 새가
  //   없다. 카톡으로 화면이 바뀌기 전에 눈에 한 번 들어와야, 채팅창에서 무엇을
  //   해야 하는지(두 장 첨부) 알고 간다. 알림은 지우지 않는다 — 돌아오시면 그대로 보인다.
  //   ★ window.open 이 아니라 location 을 쓴다. 새 창은 폰 브라우저가 막는 일이 있다.
  //   주소를 갈아타는 것은 막히지 않고, 카톡 앱으로 넘어가므로 브라우저는 뒤에 남는다.
  const b = $('#btnNext');
  $('#toast').hidden = false;
  b.textContent = '카카오톡을 여는 중';
  setTimeout(() => { b.textContent = NEXT_LABEL[LAST]; location.href = INQUIRY; }, 700);
};

/* ---- 침구 이미지 저장 ---- [대표, 2026-08-10]
   화면은 사진 위에 **색 층을 곱하기로 겹쳐** 만든다(.layer{mix-blend-mode:multiply}).
   그림 파일로 내보내려면 그 겹침을 캔버스에서 똑같이 다시 그려야 한다 — 화면에 보이는
   것을 그대로 찍어내는 방법은 브라우저에 없다. 순서는 화면과 같다:
     ① 바탕 사진을 그린다
     ② 층마다 — 빈 장을 그 색으로 채우고 → 마스크의 투명도로 오려낸 뒤(destination-in)
       → 바탕에 곱하기로 얹는다(multiply)
   ★ 사진도 마스크도 **우리 쪽(assets/) 것뿐이다.** 남의 서버 그림이 한 장이라도 섞이면
     캔버스가 오염되어 toBlob 이 막힌다. 그래서 여기서 밖의 그림을 끌어오지 않는다. */
function loadImg(src){
  return new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => no(new Error('그림을 못 받았습니다: ' + src));
    im.src = src;
  });
}
async function composeScene(){
  const scene = $('#sceneMain .scene:not([hidden])');
  if (!scene) throw new Error('그릴 사진이 없습니다');
  const el = scene.querySelector('img');
  const base = await loadImg(el.currentSrc || el.src);
  const W = base.naturalWidth, H = base.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.drawImage(base, 0, 0, W, H);
  // 층은 **화면에 놓인 차례대로** 얹는다. 겹치는 자리의 위아래가 화면과 같아야 한다.
  for (const l of scene.querySelectorAll('.layer')) {
    if (!l.dataset.maskurl) continue;
    const mask = await loadImg(l.dataset.maskurl);
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const tc = tmp.getContext('2d');
    tc.fillStyle = getComputedStyle(l).backgroundColor;
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'destination-in';   // CSS 의 mask-mode:alpha 와 같다
    tc.drawImage(mask, 0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tmp, 0, 0);
  }
  ctx.globalCompositeOperation = 'source-over';
  return new Promise((ok, no) =>
    cv.toBlob(b => b ? ok(b) : no(new Error('그림을 만들지 못했습니다')), 'image/png'));
}

/* ---- 주문 내역 그림 ---- [대표, 2026-08-10]
   저장은 **두 장**이다 — 침구 사진 한 장, 주문 내역 한 장.
   내역은 화면을 찍는 것이 아니라 **원본 글(orderText)에서 새로 그린다.** 화면 것은
   폭이 폰마다 달라 줄이 꺾인 자리가 제각각인데, 그림은 어느 폰에서 받아도 같아야 한다.
   ★ 심어둔 글꼴을 쓴다. document.fonts.ready 를 안 기다리면 아직 안 온 글꼴 대신
     기기 글꼴로 그려져 두 장의 결이 어긋난다.
   ★ 어두운 화면에서 받아도 **밝은 종이로 그린다.** 남에게 보이거나 인쇄할 그림이라
     화면 설정을 따라가면 안 된다. 그래서 색을 여기에 그대로 적는다. */
const PAPER = { bg:'#f3f0e9', fg:'#16203d', mut:'#636a7b', card:'#fdfbf6', line:'#e2ddd1' };
function rrect(c, x, y, w, h, r){
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); return; }
  c.beginPath(); c.moveTo(x+r, y);
  c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r);
  c.arcTo(x, y+h, x, y, r);     c.arcTo(x, y, x+w, y, r); c.closePath();
}
async function composeOrder(W){
  try { await document.fonts.ready; } catch(_) {}
  const S = W / 1200;                          // 사진 폭에 맞춰 글자와 여백을 함께 키운다
  const PAD = Math.round(60 * S), CPAD = Math.round(44 * S);
  const T = Math.round(46 * S), F = Math.round(29 * S), SM = Math.round(23 * S);
  const LH = Math.round(50 * S), GAP = Math.round(28 * S);
  const HEAD = '700 ' + T + 'px ' + ${JSON.stringify(FONT_HEAD)};
  const ROW  = F + 'px ' + ${JSON.stringify(FONT_BODY)};
  const ROWH = '700 ' + F + 'px ' + ${JSON.stringify(FONT_HEAD)};
  const FOOT = SM + 'px ' + ${JSON.stringify(FONT_BODY)};

  // 빈 줄은 **자리만** 차지한다. 덩어리 사이가 붙으면 어디까지가 한 항목인지 안 보인다.
  const rows = orderText.split('\\n').map(t => ({
    t: t.trim(), head: t.indexOf('■') === 0, blank: t.trim() === '',
    ind: t.length - t.replace(/^ +/, '').length,     // 들여쓴 칸수를 그대로 옮긴다
  }));
  let body = 0;
  rows.forEach(r => body += r.blank ? Math.round(LH * .5) : LH);

  /* 금액은 **quote() 에서 바로 가져온다** [대표, 2026-08-10]. orderText 에 끼워 넣지
     않는다 — 그 글은 화면 주문서가 그대로 쓰는 원본이라, 건드리면 ④ 화면 위 금액
     카드와 같은 말이 두 번 나온다. 여기서만 따로 그리면 그림에만 값이 붙는다.
     대표가 이 그림을 보고 견적서를 만든다 [대표, 2026-08-10]. 그래서 합계만이 아니라
     **줄마다 얼마인지**가 다 있어야 한다. 「가격 문의」·「주문 불가」도 그대로 옮긴다 —
     빠뜨리면 그 줄이 값이 없는 것인지 0원인지 알 수 없다. */
  const PL = Math.round(LH * .8), PGAP = Math.round(LH * .3);
  let q = null, priceH = 0;
  if (PRICE_READY) {
    q = quote();
    if (q.rows.length) {
      q.rows.forEach(() => priceH += LH + PL + PGAP);
      if (q.rows.some(r => !r.ask)) priceH += Math.round(LH * 1.25);   // 구분선 + 합계
      priceH += CPAD * 2;
    }
  }
  // ★ q.notes(똑딱이 갯수·주문 불가 …)는 **여기에 안 그린다.** renderOrder 가 이미
  //   같은 말을 「■ 확인해주세요」로 orderText 에 넣어 두어, 위 주문 내역 카드에 나온다.
  //   두 번 적으면 한 장 안에서 같은 말이 두 번 된다.
  const hasPrice = !!(q && q.rows.length);

  const titleH = Math.round(T * 1.25);
  const footH  = Math.round(SM * 1.7);
  const cardH  = body + CPAD * 2;
  const H = PAD + titleH + GAP + cardH
    + (hasPrice ? GAP + titleH + GAP + priceH : 0)
    + GAP + footH + PAD;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = PAPER.bg; c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';

  let y = PAD + Math.round(T * .95);
  c.fillStyle = PAPER.fg; c.font = HEAD;
  c.fillText('주문 내역', PAD, y);

  const cy = PAD + titleH + GAP;
  c.fillStyle = PAPER.card; rrect(c, PAD, cy, W - PAD * 2, cardH, Math.round(18 * S)); c.fill();
  c.strokeStyle = PAPER.line; c.lineWidth = Math.max(1, Math.round(S)); c.stroke();

  y = cy + CPAD + Math.round(F * .85);
  const x0 = PAD + CPAD, unit = F * .45;       // 한 칸 들여쓰기의 너비
  rows.forEach(r => {
    if (r.blank) { y += Math.round(LH * .5); return; }
    c.font = r.head ? ROWH : ROW;
    c.fillStyle = r.head ? PAPER.fg : PAPER.mut;
    c.fillText(r.t, x0 + r.ind * unit, y);
    y += LH;
  });

  let below = cy + cardH;                        // 다음 덩어리가 놓일 자리

  if (hasPrice) {
    c.fillStyle = PAPER.fg; c.font = HEAD;
    c.fillText('견적 금액', PAD, below + GAP + Math.round(T * .95));

    const py = below + GAP + titleH + GAP;
    const pw = W - PAD * 2, xr = PAD + pw - CPAD;   // 금액은 오른쪽 끝에 맞춰 적는다
    c.fillStyle = PAPER.card; rrect(c, PAD, py, pw, priceH, Math.round(18 * S)); c.fill();
    c.strokeStyle = PAPER.line; c.lineWidth = Math.max(1, Math.round(S)); c.stroke();

    y = py + CPAD + Math.round(F * .85);
    q.rows.forEach(r => {
      // 품목과 금액은 **같은 줄 양 끝**에, 딸린 설명은 그 아래 한 단 들여서.
      // 한 줄에 다 넣으면 설명이 길 때 금액과 부딪힌다 — 견적서로 옮겨 적을 값이라
      // 부딪히면 안 된다.
      c.textAlign = 'left';  c.font = ROWH; c.fillStyle = PAPER.fg;
      c.fillText(r.t, x0, y);
      c.textAlign = 'right'; c.font = ROWH;
      c.fillStyle = r.bad ? '#a8261f' : PAPER.fg;
      c.fillText(r.ask ? r.ask : won(r.a), xr, y);
      c.textAlign = 'left';  c.font = ROW;  c.fillStyle = PAPER.mut;
      c.fillText(r.d, x0 + Math.round(F * .6), y + PL);
      y += LH + PL + PGAP;
    });

    if (q.rows.some(r => !r.ask)) {
      const ly = y - PGAP + Math.round(LH * .15);
      c.strokeStyle = PAPER.fg; c.lineWidth = Math.max(1, Math.round(1.5 * S));
      c.beginPath(); c.moveTo(x0, ly); c.lineTo(xr, ly); c.stroke();
      y = ly + Math.round(LH * .95);
      c.textAlign = 'left';  c.font = ROWH; c.fillStyle = PAPER.fg; c.fillText('합계', x0, y);
      c.textAlign = 'right'; c.font = '700 ' + Math.round(F * 1.25) + 'px ' + ${JSON.stringify(FONT_HEAD)};
      c.fillText(won(q.sum) + (q.ask ? ' + 문의' : ''), xr, y);
      c.textAlign = 'left';
    }

    below = py + priceH;
  }

  c.textAlign = 'left';
  c.font = FOOT; c.fillStyle = PAPER.mut;
  c.fillText('화면에서 보이는 색상과 실제 원단의 색상은 차이가 있을 수 있습니다.',
    PAD, below + GAP + Math.round(SM * 1.1));

  return new Promise((ok, no) =>
    cv.toBlob(b => b ? ok(b) : no(new Error('내역 그림을 만들지 못했습니다')), 'image/png'));
}

/* 하단 단추의 **잰 높이**를 --navh 에 넣는다. ④ 에서 저장 단추가 한 줄 붙어 높이가
   달라지므로 박아둘 수 없다 — 박아두면 마지막 글이 단추 뒤로 숨는다. */
function syncNavH(){
  const n = document.querySelector('.nav');
  if (n) document.documentElement.style.setProperty('--navh', n.offsetHeight + 'px');
}
addEventListener('resize', syncNavH);
// 글꼴이 늦게 오면 단추 키가 한 번 더 바뀐다. 그때 다시 잰다.
try { document.fonts.ready.then(syncNavH); } catch(_) {}

const SAVE_LABEL = '내 침구 저장하기';
// 내역 그림은 사진과 **같은 폭**으로 그린다. 두 장을 나란히 놓았을 때 폭이 어긋나면
// 한 벌로 안 보인다. 사진이 아직 안 왔으면 원본 폭(1200)을 쓴다.
function sceneW(){
  const el = $('#sceneMain .scene:not([hidden]) img');
  return (el && el.naturalWidth) || 1200;
}
// ④ 에 들어설 때 **미리 만들어 쥐고 있는다.** 누른 그 순간에 만들면 만드는 사이에
// 「손님이 눌러서 하는 일」이라는 표시가 풀려, 폰에서 공유창이 안 열리는 일이 있다.
let saveFiles = null, savePending = null;
async function composeBoth(){
  const stamp = saveStamp();
  const shot = await composeScene();
  const memo = await composeOrder(sceneW());
  // 이름에 1·2 를 달아 둔다 — 갤러리에서 어느 쪽이 먼저인지 보이게.
  return [
    new File([shot], 'famafami-' + design + '-' + stamp + '-1-침구.png', { type:'image/png' }),
    new File([memo], 'famafami-' + design + '-' + stamp + '-2-주문내역.png', { type:'image/png' }),
  ];
}
function savePrepare(){
  saveFiles = null;
  savePending = composeBoth().then(f => (saveFiles = f, f), e => { console.warn(e); return null; });
}
function saveShow(on){
  const b = $('#btnSave');
  if (!b) return;
  b.hidden = !on;
  if (on) { b.disabled = false; b.textContent = SAVE_LABEL; savePrepare(); }
  syncNavH();
}
const saveStamp = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth()+1) + p(d.getDate());
};
// 한 장 내려받는다. 두 번 이어 부를 때는 폰·브라우저가 **몰아서 막는 일**이 있어
// 조금 띄워 부른다.
function pull(file){
  const a = document.createElement('a');
  const u = URL.createObjectURL(file);
  a.href = u; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
$('#btnSave').onclick = async () => {
  const b = $('#btnSave');
  const say = (t, ms) => { b.textContent = t; if (ms) setTimeout(() => b.textContent = SAVE_LABEL, ms); };
  let files = saveFiles;
  if (!files) {                      // 아직 안 됐으면 기다린다. 그래도 안 되면 한 번 더 해본다.
    b.disabled = true; say('만드는 중…');
    try { files = await (savePending || composeBoth()); } catch(_) {}
    if (!files) { try { files = await composeBoth(); } catch(_) {} }
    b.disabled = false; say(SAVE_LABEL);
  }
  if (!files) return say('저장하지 못했습니다', 2000);

  // 폰에서는 공유창이 낫다 — 「사진에 저장」이 거기 있다. 내려받기로 하면 파일앱에
  // 떨어져 갤러리에서 안 보인다. 공유가 없는 곳(컴퓨터)에서만 내려받는다.
  //   ★ 두 장을 **한 번에** 건넨다. 나눠 부르면 두 번째는 손님이 누른 것이 아니라고
  //     보아 막힌다. 두 장 받기를 못 하는 곳이면 통째로 내려받기로 간다 —
  //     한 장만 공유하고 나머지를 내려받으면 어디로 갔는지 알 수 없다.
  if (navigator.canShare && navigator.canShare({ files: files })) {
    try { await navigator.share({ files: files }); return; }
    catch(e) { if (e && e.name === 'AbortError') return; }   // 손님이 닫은 것은 잘못이 아니다
  }
  pull(files[0]);
  setTimeout(() => pull(files[1]), 600);
  say('2장 저장했습니다', 2200);
};

/* ---- 색 ---- */
// 한 부위가 **여러 사진에 걸쳐 있을 수 있다** — 양면과 삥은 같은 컷을 쓰므로
// 「이불·베개 앞면」층이 두 장에 하나씩 있다. 색을 고르면 둘 다 칠해야 한다.
// 하나만 붙들고 있으면 디자인을 바꾼 순간 색이 흰색으로 되돌아간 것처럼 보인다.
const layers = {}, dots = {}, btns = {};
const paint = (key, hex) => (layers[key] || []).forEach(l => l.style.backgroundColor = hex);
$$('#sceneMain .layer').forEach(l => (layers[l.dataset.part] = layers[l.dataset.part] || []).push(l));
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
// 손님이 카드를 **눌렀는가.** 안 눌렀으면 어느 카드에도 고른 표시를 하지 않는다 —
// 처음부터 무지에 테두리가 쳐져 있으면 고르지도 않은 것을 고른 것처럼 보인다
// [대표, 2026-08-06]. 속으로는 무지가 기본값이라 아무 때나 ② 로 넘어갈 수 있다.
let chosen = false;
function markCards(){
  $$('#designs button').forEach(b =>
    b.setAttribute('aria-pressed', chosen && b.dataset.design === design));
}
/* 사진과 마스크는 **페이지 밖 파일**이다. 고른 디자인 것만 그때 받는다 —
   디자인이 몇 가지로 늘어도 첫 화면이 무거워지지 않는 까닭이 이것이다.
   주소를 data-src / data-mask 에 적어두었다가 여기서 진짜 자리로 옮겨 심는다. */
const sceneReady = new Set();
function sceneLoad(key){
  if (sceneReady.has(key)) return;
  const s = $('#sceneMain .scene[data-design="' + key + '"]');
  if (!s) return;
  sceneReady.add(key);
  const im = s.querySelector('img[data-src]');
  if (im) { im.src = im.dataset.src; im.removeAttribute('data-src'); }
  s.querySelectorAll('.layer[data-mask]').forEach(l => {
    const u = "url('" + l.dataset.mask + "')";
    l.style.webkitMaskImage = u;   // 사파리·크롬
    l.style.maskImage = u;
    // 주소를 한 벌 남겨둔다. 그림으로 저장할 때 **마스크를 다시 읽어야** 하는데,
    // style 에서 url() 을 도로 뜯어내는 것보다 이쪽이 튼튼하다.
    l.dataset.maskurl = l.dataset.mask;
    l.removeAttribute('data-mask');   // 다 심었다는 표시 — 두 번 심지 않는다
  });
}
function syncDesign(){
  // 사진은 디자인마다 한 장씩 있고 고른 것만 보인다. 층은 그 사진 안에만 있다.
  sceneLoad(design);
  $$('#sceneMain .scene').forEach(s => s.hidden = s.dataset.design !== design);
  PARTS.forEach(p => {
    paint(p.key, paintOf(p));
    if (pickable(p)) {
      btns[p.key].hidden = !inDz(p, design);
      dots[p.key].style.background = state[p.key].hex;
    }
  });
  renderPillows();
  markCards();
  const d = DESIGNS.find(x => x.key === design);
  $('#dnowT').textContent = d.ko;
  // 카드 설명의 **첫 줄**을 쓴다. 줄을 다 이어 붙이면 폰에서 이 작은 칸이 두세 줄로 늘어난다.
  $('#dnowD').textContent = d.cd[0];
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
// 같은 디자인을 다시 눌러도 setDesign 은 일찍 빠져나가므로, 고른 표시는 따로 켠다.
$$('#designs button').forEach(b => b.onclick = () => {
  chosen = true; setDesign(b.dataset.design); markCards(); navigate(1);
});
$('#dchg').onclick = () => navigate(0);
// 표지 아래 안내를 누르면 카드까지 내려간다. 손으로 밀어 내리는 것과 같은 자리로 간다.
$('#bmore').onclick = () => $('#designs').scrollIntoView({ behavior:'smooth', block:'center' });
// 화면마다 할 말이 다르다. 색 화면에서는 처음에 전부 흰색이라 그 말을 해주는데,
// 색을 하나라도 바꾸면 더는 사실이 아니므로 말을 바꾼다.
// 머리글 아래 한 마디. 단계마다 **지금 무엇을 하는 자리인지**를 말한다.
// 전에는 어느 단계에서나 색 이야기(「지금은 6곳 모두 흰색입니다…」)가 떠서,
// 사이즈·확인 화면에서 엉뚱했다. 두 줄로 끊어 폰에서도 읽히게 한다. [대표, 2026-08-07]
const SUB = [
  '',   // ① 은 표지라 머리글 자체를 감춘다
  '이제, 당신의 취향을 담아볼 차례입니다.<br>바꾸고 싶은 곳을 눌러 원단과 색을 직접 골라보세요.',
  '고르신 색으로 만들 크기를 정합니다.<br>필요 없는 항목은 제외하셔도 됩니다.',
  '고르신 내용을 확인해보세요.<br>카톡으로 보내주시면 확인해 드립니다.',
];
function renderSub(){ $('#sub').innerHTML = SUB[step] || ''; }
function label(c){ return c.no ? \`NO. \${c.no} · \${c.ko} \${c.su}수\` : c.ko; }
// 「매트리스커버는」 / 「날개(테두리)는」 — 받침이 있으면 「은」이다. 부위 이름이 괄호로
// 끝나기도 해서(line(테두리)) **마지막 한글 글자**를 찾아 본다. 한글이 없으면 「는」.
function josa(s){
  const m = String(s).match(/[가-힣](?=[^가-힣]*$)/);
  return m && (m[0].charCodeAt(0) - 0xac00) % 28 ? '은' : '는';
}
function apply(c){
  state[cur.key] = c;
  touched[cur.key] = 1;
  paint(cur.key, c.hex);
  dots[cur.key].style.background = c.hex;
  // 이 부위를 따라가는 자리(삥)도 같이 칠한다. 안 하면 앞면만 바뀌고 테두리가 흰 채로 남는다.
  PARTS.forEach(p => { if (p.follow === cur.key) paint(p.key, c.hex); });
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
  // 부위 이름을 박아두면 안 된다 — 매트리스커버 말고 **테두리에도** 이 제한이 걸린다
  // [대표, 2026-08-10]. 박아뒀더니 날개 색을 고르는데 「매트리스커버는…」이 떴다.
  // 까닭(suWhy)은 부위마다 다를 수 있으니 적어둔 자리만 붙인다 — 지어내지 말 것.
  $('#palHint').textContent = allow
    ? \`\${cur.ko}\${josa(cur.ko)} \${allow.join('·')}수만 됩니다\`
      + (cur.suWhy ? \` (\${cur.suWhy})\` : '') + \` — \${shown}색\`
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
// 「다른 컬러」면 베개커버도 **무조건 양면**이다 [대표, 2026-08-07].
// 전에는 체크칸으로 물었는데, 사진이 이미 베개 앞뒤를 다르게 보여주고 있어서
// 체크를 푸는 쪽이 오히려 사진과 어긋났다. 물음 자체를 없앴다.
const pilTwo  = () => canTwo();
// 이 부위들이 실제로 **여러 색으로** 만들어지는가. 테두리(삥)는 뺀다 — 천이 갈리는 것은
// 앞면과 뒷면 이야기다.
const facesDiffer = keys => {
  const k = keys.filter(x => !(PARTS.find(p => p.key === x) || {}).trim);
  return k.length > 1 && !k.every(x => state[x].hex === state[k[0]].hex);
};
// **양면으로 만드는가.** 값과 주문서가 반드시 같은 판단을 써야 한다.
//   보통은 디자인이 정한다 — 「다른 컬러」는 앞뒤를 같은 색으로 고르셔도 양면 제품이다.
//   twoByColor 인 디자인(삥)만 **실제로 고르신 색**을 보고 정한다 [대표, 2026-08-09].
//   ★ 주석에 백틱을 쓰지 말 것 — 이 코드는 build.js 의 템플릿 리터럴 안에 있어서
//     백틱 하나가 문자열을 끊어버린다. 달러+중괄호와 역슬래시도 마찬가지다.
const twoByColor = () => !!((PRICE.design || {})[design] || {}).twoByColor;
const madeTwo = () => {
  if (!pilTwo()) return false;
  if (!twoByColor()) return true;
  return facesDiffer(slots().flatMap(s => s.faces).map(f => f.part));
};
// 주문서에 적을 베개커버 종류. **이불 디자인 이름을 그대로 베끼지 않는다** — 베개커버가
// 이불과 달라지는 경우(bothPlain)를 되살리면 그때 어긋난다. 지금 칸이 실제로 무슨
// 색을 받는지에서 지어낸다. 삥이 걸린 칸이면 테두리도 있다고 적는다.
const pilKind = () => {
  const base = madeTwo() ? '앞뒤 다른 컬러' : '앞뒤 같은 컬러';
  // 테두리 이름은 디자인마다 다르다 (삥 / 날개). 박아두지 말고 부위에서 가져온다.
  const t = slots().flatMap(s => s.faces).map(f => PARTS.find(p => p.key === f.part))
    .find(p => p && p.trim);
  return t ? base + ' · ' + (t.face || t.ko) : base;
};
// 디자인이 칸 구성을 직접 지정할 수 있다 (삥은 색이 하나 더 붙는다). 없으면 예전대로.
const slots   = () => {
  const d = DESIGNS.find(x => x.key === design);
  return PIL_MODES[d.pilMode || (canTwo() ? 'bothTwo' : 'single')];
};
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
  // 고른 것에 따라 **달라지는 말만** 여기에 넣는다. 늘 같은 안내는 HTML 에 적어뒀다.
  // 화면 구조를 설명하는 말(「②에서 고르신 4칸이…」)은 쓰지 않는다 [대표, 2026-08-07].
  $('#pDesc').innerHTML = [
    // 「다른 컬러」는 베개가 이불과 한 몸이라 한 장씩 다르게 못 고른다. 미리 알려야 한다.
    one ? '베개커버는 이불과 같은 색으로 나갑니다.' : '',
    // 체크칸을 없앤 뒤로 「다른 컬러」면 늘 앞뒤가 다르다. 사진 그대로라는 말이 된다.
    //   삥은 앞뒤를 같은 색으로 두실 수 있고 그러면 사실이 아니게 되므로 madeTwo 를 본다.
    madeTwo() ? '한 장의 앞면과 뒷면이 다른 색입니다.' : '',
    '주문하지 않을 항목은 0장으로 두세요.',
  ].filter(Boolean).join('<br>');
  const n = pillowCount();
  $('#pTot').textContent = !n ? '전부 0장 — 베개커버는 주문하지 않는 것으로 봅니다'
    : one ? '모두 ' + n + '장'   // 칸이 하나면 사이즈별 내역이 바로 위 줄과 같은 말이다
    : '모두 ' + n + '장  ·  ' + pillowBySize().map(([s, c]) => s + ' ' + c + '장').join(', ');
}
$$('.pq, .ps').forEach(s => s.onchange = renderPillows);

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
const height = () => dim('m_h');
const heightTyped = () => dimTyped('m_h');
const heightJunk  = () => heightTyped() && height() == null;   // 적긴 했는데 못 읽는 값
const tooTall     = () => { const h = height(); return H_MAX != null && h != null && h > H_MAX; };

/* 매트리스 실제 치수는 **안 적으면 ④로 못 넘어간다** [대표, 2026-08-07].
   만들 때 쓰는 치수라 없으면 주문이 성립하지 않고, 높이는 값까지 달라진다.
   전에는 견적 금액에서 「적어주세요」로 알리기만 해서 그냥 지나칠 수 있었다. */
const MAT_DIMS = [['m_w','가로'], ['m_d','세로'], ['m_h','높이']];
// 「매트리스커버는 안 할래요」면 아무것도 묻지 않는다.
const matMissing = () => $('#m_skip').checked ? [] : MAT_DIMS.filter(([id]) => dim(id) == null);
// 빈 칸을 빨갛게 짚는 것은 **한 번 막힌 뒤부터**다. 들어오자마자 빨간 칸을 보여주면
// 아직 적을 기회도 없었는데 혼난 것처럼 보인다.
let matTried = false;

function checkHeight(){
  const off = $('#m_skip').checked;
  const tall = !off && tooTall(), junk = !off && heightJunk();
  const miss = matMissing();
  MAT_DIMS.forEach(([id]) => $('#' + id).classList.toggle('bad',
    (id === 'm_h' && (junk || tall)) || (matTried && !off && dim(id) == null)));
  // 못 만드는 것(높이 초과)이 제일 급하고, 그다음이 막힌 이유, 마지막이 못 읽는 값이다.
  const msg = tall
    ? '높이 ' + H_MAX + 'cm까지만 주문받습니다. 이 매트리스커버는 만들어 드릴 수 없습니다 — 「매트리스커버는 안 할래요」로 넘어가 주세요.'
    : matTried && miss.length
    ? miss.map(m => m[1]).join('·') + '를 숫자로 적어주세요. 만들 때 쓰는 치수입니다.'
    : junk
    ? '높이를 숫자로 적어주세요. (예: 30)'
    : '';
  const w = $('#m_hWarn');
  w.hidden = !msg;
  w.textContent = msg;
}
// 막혔던 분이 칸을 채우면 그 자리에서 빨간 표시가 풀려야 한다.
MAT_DIMS.forEach(([id]) => { $('#' + id).oninput = checkHeight; });
$('#m_skip').addEventListener('change', checkHeight);

/* ---- 종류 ---- */
const designKo   = () => DESIGNS.find(d => d.key === design).ko;
// 밖으로 나가는 글(주문서·견적)에는 긴 이름을 쓴다. 화면에는 짧은 이름(ko)을 쓴다.
const designOn   = () => {
  const d = DESIGNS.find(x => x.key === design);
  // 삥처럼 **고르신 색으로 만드는 법이 갈리는** 디자인은 그것을 이름에 적는다.
  // 이불 값은 앞뒤가 같든 다르든 같지만(대표, 2026-08-06), 만들 때 갈리는 자리라
  // 주문서에 그대로 나가야 한다. 값과 이름이 따로 놀면 대표가 어느 쪽을 믿을지 모른다.
  if (d.onSame && !facesDiffer(quiltParts().map(p => p.key))) return d.onSame;
  return d.on || d.ko;
};
// 두께는 화면에서 「간절기용 (8온스)」로 고르지만 금액 줄에는 괄호 안만 쓴다.
// 줄이 길어지면 폰에서 접혀 정작 봐야 할 사이즈가 아래로 밀린다.
//   ★ 여기서 정규식을 쓰지 않는 것은 일부러입니다. 이 코드는 build.js 의 템플릿 리터럴
//   안에 있어서 \\( 처럼 겹쳐 쓰지 않으면 **역슬래시가 먹힙니다.** /\\(([^)]+)\\)/ 로
//   적었다가 페이지에는 /(([^)]+))/ 로 나가 「간절기용 (8온스」가 찍혔습니다.
//   괄호가 없는 값이 오면 통째로 그대로 씁니다. [2026-08-07]
const ozShort    = v => {
  const i = v.indexOf('('), j = v.lastIndexOf(')');
  return i >= 0 && j > i ? v.slice(i + 1, j).trim() : v.trim();
};
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
  // 맞춤 추가금은 값에 **넣기만 하고 말하지 않는다** [대표, 2026-08-07].
  // 「맞춤 추가금이 포함된 금액입니다」라고 적어뒀더니, 이미 다 들어간 값인데도
  // 뭔가 더 붙는 것으로 읽혔다. 높이 추가금도 같은 이유로 말하지 않는다.
  const fee = (sale, custom) => {
    if (sale == null || (ALWAYS_CUSTOM && custom == null)) return null;
    return sale + (ALWAYS_CUSTOM ? custom : 0);
  };
  // 고른 디자인에 붙는 웃돈. 「같은 컬러」 기준이라 적어두지 않은 디자인은 0 이다.
  // 값은 **단가에 녹여** 넣고 줄을 따로 내지 않는다 — 맞춤·높이 추가금과 같은 이유다.
  //   이불 웃돈은 **사이즈마다** 갈릴 수 있고 [대표, 2026-08-10], line 은 거기에 더해
  //   **고르신 색**으로도 갈린다 — 앞뒤가 같은 색이면 원단 마수가 안 늘기 때문이다.
  //   ★ 그 판단은 반드시 madeTwo() 를 쓴다. 주문서 이름(designOn)도 같은 것을 보므로
  //     여기서 따로 세면 「앞뒤 같은 컬러 · line」이라 적힌 주문에 양면 값이 나간다.
  //   표에 없는 사이즈는 빌드가 막으므로 여기까지 오지 않는다.
  const dAdd = (what, size) => {
    let v = ((PRICE.design || {})[design] || {})[what];
    if (v == null) return 0;
    if (v.same !== undefined || v.two !== undefined) v = madeTwo() ? v.two : v.same;
    if (v == null) return 0;
    return typeof v === 'object' ? (v[size] || 0) : v;
  };

  if (!$('#q_skip').checked) {
    const k = quiltKind(), size = $('#q_size').value, n = +$('#q_qty').value;
    const base = fee(PRICE.quilt.sale[k.key][size], PRICE.quilt.custom);
    const p = base == null ? null : base + dAdd('quilt', size);
    // 양면 이불은 슈퍼싱글만 무지와 값이 같고 퀸부터 갈린다 [대표, 2026-08-10].
    //   2026-08-06 에는 「양면 이불 값은 무지와 같다」였다 — 그 말을 믿고 짠 데가 없는지 볼 것.
    // 두께는 **값이 달라지는 선택이 아닌데도** 적는다 — 차렵이불에서 손님이 고른 것이고,
    // 금액 줄에 없으면 「내가 고른 8온스가 맞나」를 확인할 데가 없다 [대표, 2026-08-07].
    // 이불커버는 솜이 없어 온스 칸 자체가 안 뜨므로(k.oz) 여기서도 빠진다.
    const d = [designOn(), k.ko, k.oz ? ozShort($('#q_oz').value) : null, size,
               n > 1 ? n + '장' : null].filter(Boolean).join(' · ');
    add(p == null ? { t:'이불', d, ask:'가격 문의' } : { t:'이불', d, a:p * n });
    if (k.snap && !snap()) notes.push('이불 연결 똑딱이 갯수를 적어주세요. 쓰시던 이불의 똑딱이 수와 맞춰 만듭니다.');
  }
  if (!$('#m_skip').checked) {
    const k = matKind(), size = $('#m_size').value, n = +$('#m_qty').value;
    let unit = fee(PRICE.mattress.sale[k.key][size], PRICE.mattress.custom),
        d = k.short + ' · ' + size, tall = false;
    if (unit != null && HT_ALL.length) {
      const h = height();
      // 높이를 안 적으셨으면 추가금 없이 계산한다. 그 사실을 여기서 말하지는 않는다 —
      // ③ 높이 칸이 물어보는 자리고, 금액 줄에서 다시 말하면 재촉으로 읽힌다.
      if (h != null) {
        const t = HT_ALL.find(t => h <= t.upto);
        d += ' · 높이 ' + h + 'cm';
        // 주문 불가는 값 이야기가 아니라 **못 만든다는 이야기**라 반드시 남긴다.
        if (!t) { tall = true; notes.push('매트리스 높이는 ' + H_MAX + 'cm까지만 주문받습니다. 이 매트리스커버는 만들어 드릴 수 없습니다.'); }
        // 높이 추가금은 값에 더하기만 하고 「(+15,000원)」처럼 드러내지 않는다.
        // 이미 오른쪽 금액에 들어가 있어, 적어두면 거기서 또 붙는 것처럼 보인다. [대표, 2026-08-07]
        else if (t.add) unit += t.add;
      }
    }
    if (n > 1) d += ' · ' + n + '장';
    add(tall ? { t:'매트리스커버', d, ask:'주문 불가', bad:true }
      : unit == null ? { t:'매트리스커버', d, ask:'가격 문의' } : { t:'매트리스커버', d, a:unit * n });
  }
  if (!$('#p_skip').checked) {
    // 양면이면 1장당 값이 더 든다. **단가에 녹여** 넣고 줄을 따로 내지 않는다 —
    // 「양면 2장 · 2장까지 10,000원」을 한 줄로 뽑았더니 이미 든 값인데도 추가금으로
    // 읽혔다 [대표, 2026-08-07]. 손님에게는 그냥 베개커버 값으로 보인다.
    // 양면 웃돈은 **양면으로 만들 때만** 붙는다. 삥은 앞뒤를 같은 색으로 고르시면
    // 천이 한 종류라 안 붙는다 (madeTwo). 디자인 웃돈은 그 위에 얹는다.
    //   앞뒤 같은 색 삥 → 28,000 + 1,000 = 29,000
    //   앞뒤 다른 색 삥 → 28,000 + 5,000 + 1,000 = 34,000
    const two = ((madeTwo() && PRICE.pillow.two) ? PRICE.pillow.two.add : 0) + dAdd('pillow');
    // 사이즈마다 값이 다르므로 사이즈별로 한 줄씩 낸다.
    for (const [size, n] of pillowBySize()) {
      let unit = fee(PRICE.pillow.sale[size], PRICE.pillow.custom);
      if (unit != null) unit += two;
      const d = size + ' · ' + n + '장';
      // k = 줄이 여럿일 때 구분하는 꼬리표. 복사 텍스트에서 "베개커버"만 두 줄 나오는 걸 막는다.
      add(unit == null ? { t:'베개커버', k:size, d, ask:'가격 문의' } : { t:'베개커버', k:size, d, a:unit * n });
    }
  }
  // 양면으로 고르셨는데 앞뒤 색이 같으면 알린다 — 손님이 뒷면을 안 고른 것일 수 있고,
  // 그러면 대표가 「양면인데 왜 한 색?」을 물어봐야 한다.
  // ★ twoByColor 인 디자인에서는 **말하지 않는다.** 거기서 앞뒤를 같은 색으로 두는 것은
  //   실수가 아니라 **고르실 수 있는 것**이고, 값도 그만큼 싸게 나간다. 그런데도
  //   「같은 색입니다」라고 짚으면 잘못 고른 것처럼 읽힌다.
  // ★★ 그래서 **지금은 어느 디자인에서도 안 뜬다** [2026-08-10]. 「다른 컬러」까지
  //   twoByColor 가 되면서 마지막 자리가 없어졌다. 지우지 않고 두는 것은, 고른 색을
  //   안 보는 양면 디자인이 다시 생기면 그때 살아나야 하기 때문이다.
  //   **안 뜬다고 고장 난 것이 아니다** — 여기서 시간을 버리지 말 것.
  {
    const qf = quiltParts().filter(p => !p.trim).map(p => p.key);   // 테두리는 뺀다
    if (!$('#q_skip').checked && !twoByColor() && qf.length > 1 && !facesDiffer(qf))
      notes.push('「' + designKo() + '」로 고르셨는데 앞면과 뒷면이 같은 색입니다. 그대로 하셔도 되고 ② 색에서 바꾸실 수 있습니다.');
  }
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
  // 뜰 말이 없으면 빈 <p> 가 남아 합계 아래 여백만 벌어진다.
  $('#qNote').hidden = !notes.length;
  $('#qNote').innerHTML = notes.map(n => '· ' + n).join('<br>');
}

// 주문 내역의 **원본 글**이다 [대표, 2026-08-10]. 화면(#orderTxt)은 이 글을 줄마다
// 그린 것뿐이고, 저장되는 주문 내역 그림(composeOrder)도 이 글에서 그린다.
// 화면에서 긁으면 줄바꿈이 사라지므로 어느 쪽도 화면을 긁지 않는다.
//   ★ 클립보드로 복사하던 일은 없앴다 — 이제 그림 두 장을 채팅창에 첨부한다.
let orderText = '';
function renderOrder(){
  const L = [];
  if (!$('#q_skip').checked) {
    const k = quiltKind();
    // 디자인은 늘 적는다. 앞뒤가 같은 색인지 다른 색인지가 만들 때 갈리는 자리다.
    L.push('■ 이불', '   디자인 : ' + designOn(), '   종류 : ' + k.ko, '   사이즈 : ' + $('#q_size').value);
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
    // 이불 디자인 이름과 같은 말을 쓴다 — 「무지/양면」과 「같은/다른 컬러」가 섞이면
    // 주문서에서 무엇이 무엇인지 헷갈린다 [2026-08-07].
    L.push('■ 베개커버', '   종류 : ' + pilKind());
    pillowRows().forEach(r => {
      // 칸이 하나면 칸 이름이 「베개커버」라 바로 위 줄과 겹친다. 사이즈로 적는다.
      const head = '   ' + (one ? '사이즈' : r.sl.ko) + ' : ' + r.size + ' · ' + r.n + '장';
      // 색은 **늘 아랫줄**에 적는다 [대표, 2026-08-10]. 한 색일 때 한 줄에 붙였더니
    // 「베개(앞)-왼쪽 : 50×70 · 1장  /  NO. 952 · 멜트 아이스크림 60수」가 45자라
    // 폰에서 두 줄로 꺾이고, 꺾인 줄이 왼쪽 끝까지 밀려 나와 읽기 나빴다.
    // 카톡에 붙는 글도 같은 폭에서 같은 일이 난다 — 화면만 고쳐서는 안 된다.
    // 들여쓰기는 **네 칸**이다. 여섯 칸이면 320px 폰에서 색 이름 줄이 넘친다.
      L.push(head);
      if (r.sl.faces.length === 1) L.push('    컬러 : ' + label(state[r.sl.faces[0].part]));
      else r.sl.faces.forEach(f => L.push('    컬러(' + f.face + ') : ' + label(state[f.part])));
    });
    // 칸이 하나면 합계가 바로 위 줄과 같은 말이다.
    if (!one) L.push('   모두 ' + pillowCount() + '장 ('
      + pillowBySize().map(([s,c]) => s + ' ' + c + '장').join(', ') + ')');
    L.push('');
  }
  if (PRICE_READY) {
    const q = quote();
    // ★ 견적 금액은 **주문서에 안 적는다** [대표, 2026-08-10] — ④ 화면 위에서 이미
    //   보여줬는데 주문 내역에 또 나오면 같은 말이 두 번 된다. 저장되는 내역 그림도
    //   이 글에서 그리므로, 손님이 간직하는 그림에도 값이 박히지 않는다.
    //   ※ 안내는 남긴다. **금액이 아니라 만들 때 필요한 말**이다 —
    //   「똑딱이 갯수를 적어주세요」, 「이 매트리스커버는 만들어 드릴 수 없습니다」 같은 것.
    //   이것까지 빼면 대표가 물어봐야 알 수 있는 것이 그대로 묻힌다.
    // 보내는 방법(첨부·결제 링크)은 화면 안내(.ordnote)가 말한다. 주문서에는 아무 말도
    // 붙이지 않는다 — 안에서 제 보내는 법을 설명하면 순환이 된다. [대표, 2026-08-07]
    if (q.notes.length) {
      L.push('■ 확인해주세요');
      q.notes.forEach(n => L.push('   ※ ' + n));
      L.push('');
    }
  }
  const memo = $('#memo').value.trim();
  if (memo) L.push('■ 요청사항', '   ' + memo, '');
  if (!L.length) L.push('선택하신 항목이 없습니다.');
  // ★ 줄마다 따로 그린다 [2026-08-10]. 한 덩어리로 넣으면 **꺾인 줄이 왼쪽 끝으로**
  //   떨어져 새 항목처럼 보인다 — text-indent 는 블록의 **첫 줄**에만 걸려서
  //   pre 하나로는 매달린 들여쓰기를 못 만든다. 줄을 각각 블록으로 만들어야 걸린다.
  //   ★ 주문 내역 그림도 화면에서 긁지 말고 **여기서 만든 원본**을 쓴다 (orderText).
  //     줄을 나눠 그리면 textContent 에 줄바꿈이 안 남아, 화면을 긁으면 한 줄로 붙는다.
  orderText = L.join('\\n').trim();
  //   빈 줄은 **폭 없는 공백**을 넣어야 자리를 차지한다. 빈 블록은 높이가 0 이라
  //   덩어리 사이 여백이 통째로 사라진다 (원본 글에는 그대로 빈 줄이 있어 안 보인다).
  $('#orderTxt').innerHTML = orderText.split('\\n')
    .map(l => '<span class="ol">'
      + (l === '' ? '&#8203;' : l.replace(/&/g,'&amp;').replace(/</g,'&lt;')) + '</span>').join('');
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

// 밖으로 뺀 사진·마스크를 `assets/` 에 내보낸다. **이 폴더도 같이 올라가야 한다**
// (`.github/workflows/deploy.yml`). 안 올리면 ② 색 화면이 흰 종이로 나간다.
//   지난번에 내보냈다가 이제 안 쓰는 파일은 지운다. 남겨두면 죽은 사진이 딸려 올라가고,
//   나중에 「이 사진 아직 쓰나」를 아무도 모르게 된다.
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT))
  if (!OUTFILES.has(f) && fs.statSync(path.join(OUT, f)).isFile()) fs.unlinkSync(path.join(OUT, f));
for (const [f, src] of OUTFILES) fs.copyFileSync(src, path.join(OUT, f));

const kb = Math.round(fs.statSync(path.join(ROOT,'index.html')).size / 1024);
const akb = Math.round([...OUTFILES.keys()]
  .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024);
const dz = DESIGNS.map(d => `${d.ko} ${PARTS.filter(p => inDz(p, d.key) && pickable(p)).length}곳`).join(' · ');
const steps = (html.match(/<section class="step"/g) || []).length;
console.log(`index.html 생성 — 원단 ${total}색 / 디자인 ${DESIGNS.length}가지 (${dz}) / ${steps}단계`);
console.log(`  첫 화면 ${kb}KB  +  assets/ ${akb}KB (${OUTFILES.size}장 — 고른 디자인 것만 받는다)`);
