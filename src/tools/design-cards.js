// 디자인 고르는 카드에 넣을 작은 사진 4장을 만든다.
// 색표(C)는 하나만 둔다. 색을 카드마다 따로 적어두면 대표가 색을 바꿀 때 한쪽만 바뀐다.
//
// ★ **카드마다 색이 다르다** [대표, 2026-08-10]. 대표가 카드별로 번호를 짚어 주셨다 —
//   「다 같은 계열로 하라는 게 아니야. 웹페이지 바탕이 아이보리니까 어울리는 컬러로.」
//   2026-08-06 까지는 **네 카드가 같은 색**이었다(이불 아몬드 밀크 · 매트리스 베링씨).
//   디자인 차이만 보이게 하려던 것인데, 화면이 통째로 푸르게 보인다고 하셔서 뒤집혔다.
//   색을 바꿀 일이 생기면 **카드별로 물어볼 것** — 한 색으로 되돌리지 말 것.
//
// 두 카드는 **사진이 다르다.** 무지는 침대를 옆에서 본 컷, 양면은 위에서 비스듬히 본
// 세로 컷이다. 양면 컷을 골라 쓰는 이유는 베개 앞뒤가 한 장에 같이 보이기 때문이다
// (`src/tools/split-piping.js` 참조). 그래서 crop 도 사진마다 따로 잡는다.
//
// 자르는 자리 — 이불 앞면과 젖혀진 뒷면이 둘 다 들어가야 한다. 침대 전체를 담으면
// 작은 카드에서 이불이 너무 작아져 차이가 안 보인다.

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;

// 색은 대표가 정한 것이다 [대표, 2026-08-06]. 팔레트에 실제로 있는 번호를 쓴다 —
// 카드에만 있는 색을 칠하면 손님이 그 색을 찾다가 없다.
const C = {
  c952:  '#f5f4ef',   // NO. 952  멜트 아이스크림 60수 — 무지 이불 · 양면 뒷면 · 날개 매트리스커버
  n925:  '#aeb2b1',   // NO. 925  뉴트럴 그레이 80수   — 무지 매트리스커버
  b2006: '#c2d1ca',   // NO. 2006 블루 헤이즈 100수   — 무지 베개
  d2013: '#eadbba',   // NO. 2013 매직 더스트 100수   — 무지 베개
  r2004: '#f2d0ce',   // NO. 2004 체리 블라섬 100수   — 무지 베개(뒤)-왼쪽 [대표, 2026-08-10]
  y2010: '#eac070',   // NO. 2010 미스티드 옐로우 100수 — 무지 베개(뒤)-오른쪽 [대표, 2026-08-10]
  g963:  '#e2e7b1',   // NO. 963  애플 라임 60수      — 양면 앞면
  q901:  '#f1ebdb',   // NO. 901  아몬드 밀크 80수    — 양면 매트리스커버
  w2003: '#fbf1dd',   // NO. 2003 화이트 캡 100수     — line 이불 앞뒤 · 날개 바탕
  k932:  '#23272a',   // NO. 932  에보니 블랙 80수    — line 테두리
  g924:  '#cdcec9',   // NO. 924  미라지 그레이 80수   — line 매트리스커버
  f964:  '#587056',   // NO. 964  포레스트 그린 60수   — 날개(테두리)
  // 2026-08-10 이전에 쓰던 색 — 되돌릴 때를 위해 남긴다.
  //   939 베링씨 #556378 · 2012 아쿠아 에스케 #c1dee6 · 970 카키 그레이지 #c1beab · 980 딥 블랙 #252628
};
// 무지 카드의 베개 네 칸은 일부러 섞는다 — **한 장씩 따로 고를 수 있다**는 것이
// 카드에서부터 보여야 한다 [대표, 2026-08-10]. 양면·line 카드에는 이 자유가 없다
// (베개가 이불을 따라간다).
//   ★ 대표가 주신 주문서에는 **앞 두 장만** 있었다 (앞-왼쪽 2006 · 앞-오른쪽 2013).
//     주문서에는 **사신 장수만** 나오므로 뒤 베개 둘은 거기 없다. 뒤 두 자리는 대표가
//     따로 짚어 주셨다 [2026-08-10] — 뒤-왼쪽 2004(체리 블라섬), 뒤-오른쪽 2010(미스티드 옐로우).
//     **네 자리가 다 다른 색이다.** 「한 장씩 따로 고른다」가 카드에서 제일 세게 읽히는 상태다.
//   ★ **키 이름을 믿지 말 것.** 자리와 안 맞는다 [2026-08-10 에 바로잡음] —
//     pillowL = 앞줄 왼쪽 · pillowF = 앞줄 오른쪽 · pillowW = 뒷줄 왼쪽 · pillowR = 뒷줄 오른쪽.
//     전에는 이 표를 키 이름대로 채워서 **카드에도 색이 밀려 칠해졌다.**
//     헷갈리면 마스크마다 다른 색을 넣어 한 장 뽑아 보십시오 — 눈으로 보는 것이 제일 빠릅니다.
const PILLOWS = {
  pillowL: C.b2006,   // 앞줄 왼쪽  — 2006 블루 헤이즈
  pillowF: C.d2013,   // 앞줄 오른쪽 — 2013 매직 더스트
  pillowW: C.r2004,   // 뒷줄 왼쪽  — 2004 체리 블라섬
  pillowR: C.y2010,   // 뒷줄 오른쪽 — 2010 미스티드 옐로우
};

// 양면 — 앞면 애플 라임, 뒷면 멜트 아이스크림, 매트리스 아몬드 밀크 [대표, 2026-08-10].
//   삥 자리는 앞면 색으로 덮어 안 보이게 한다. 페이지에서도 그렇게 쓴다.
const BOTH = { bothA:C.g963, bothB:C.c952, bothM:C.q901, bothP:C.g963 };
// line — 이불 **앞뒤가 같은 색**이고 테두리만 에보니 블랙이다 [대표, 2026-08-10].
//   양면 카드와 사진은 같지만 색은 이제 따로다. 앞뒤를 같은 색으로 두신 것은
//   실수가 아니라 고르실 수 있는 것이고, 값도 그만큼 싸게 나간다 (PRICE.design.piping).
const PIP  = { bothA:C.w2003, bothB:C.w2003, bothM:C.g924, bothP:C.k932 };

const SHOTS = {
  // base.jpg(1200×1500) — 이불 앞면(왼쪽 아래)과 베개 네 개가 들어오는 자리.
  // 폰에서 두 칸 그리드면 카드 하나가 175px 남짓, 2배 화면이라 350px 이면 충분하다.
  //   ★ 자르는 자리를 위로 올렸다 [대표, 2026-08-10]. 전에는 y=500 부터 잘라서
  //     **베개 네 개가 윗머리만 남고 다 잘렸다.** 이 카드가 보여줄 것은
  //     「베개를 한 장씩 따로 고를 수 있다」는 것인데 그게 안 보였다.
  //     베개는 사진에서 y 300~760, x 60~1120 에 걸쳐 있다. 넷이 다 들어오는
  //     가장 당긴 자리가 이것이다 — 더 당기면 오른쪽 베개가 잘린다.
  'card_plain.jpg': { base:'base.jpg', w:520, q:76,
    crop:{ left:60, top:280, width:1060, height:1060 },
    paint:{ quilt:C.c952, mattress:C.n925, ...PILLOWS } },
  // base_both.jpg(1200×1600) — 베개 둘과 젖혀진 이불이 다 들어와야 양면인 게 보인다.
  // 삥은 앞면과 같은 색으로 덮어 안 보이게 한다. 페이지에서도 그렇게 쓴다.
  'card_both.jpg':  { base:'base_both.jpg', w:520, q:76,
    crop:{ left:80, top:400, width:1120, height:1120 }, paint:BOTH },
  // 날개형 — 사진이 따로다(base_wing.jpg 1200×1600).
  //   ★ 색은 **대표가 번호로 짚어 정한 것이다** [대표, 2026-08-10] — 이불·베개 바탕
  //     2003(화이트 캡), 날개 964(포레스트 그린), 매트리스커버 952(멜트 아이스크림).
  //     전에는 이불 901 · 베개 2006 · 매트리스 939 · 날개 980(딥 블랙)이었다.
  //   이 디자인에서 다른 것은 날개다. 바탕 둘이 다 밝은 크림이라 초록이 또렷하게 선다 —
  //   날개가 안 보이면 카드를 둔 뜻이 없다.
  //   베개는 이불 색을 따라가는 디자인이라(PARTS.wPillow 의 follow) 카드에서도 같은 색이다.
  //   ★ wPillowB(뒤에 놓인 베개)를 빼먹지 말 것 — 혼자 흰 채로 남으면 고장 난 것처럼 보인다.
  'card_wing.jpg':  { base:'base_wing.jpg', w:520, q:76,
    crop:{ left:150, top:560, width:900, height:900 },
    paint:{ wQuilt:C.w2003, wPillow:C.w2003, wPillowB:C.w2003, wMat:C.c952, wWing:C.f964 } },
  // line — 양면과 **사진만** 같고 색은 따로다 [대표, 2026-08-10]. 테두리 에보니 블랙.
  //   ★ 크롭도 더 당겨 잡는다. 양면 카드와 같은 자리로 두었더니 **삥이 1픽셀도 안 됐다** —
  //     폰에서 카드 한 장이 175px 라 1120px 를 우겨 넣으면 6px 짜리 테두리가 0.9px 로 준다.
  //     카드는 「디자인끼리 무엇이 다른지」를 보여주는 자리다. 안 보이면 카드를 둔 뜻이 없다.
  //     베개를 크게 잡되 젖혀진 이불도 남겨서 「앞뒤가 다르다」는 것까지 같이 보이게 했다.
  'card_piping.jpg': { base:'base_both.jpg', w:520, q:76,
    crop:{ left:150, top:450, width:820, height:820 }, paint:PIP },
  // ★ ① 표지 사진(hero.jpg)은 여기서 만들지 않는다. 실제로 찍은 사진이라
  //   흰 바탕에 색을 입히는 이 방식이 필요 없다 — `src/tools/brand-hero.js` 참조.
};
const hex2rgb = h => [1,3,5].map(i => parseInt(h.substr(i,2),16));

(async () => {
  for (const [name, { base: bf, crop, paint, w, q }] of Object.entries(SHOTS)) {
    if (!fs.existsSync(OUT + bf)) throw new Error(`바탕 사진이 없습니다: ${bf}`);
    const { data: base, info } = await sharp(OUT + bf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    if (crop.left + crop.width > W || crop.top + crop.height > H)
      throw new Error(`${name} 의 crop 이 ${bf}(${W}×${H}) 밖으로 나갑니다`);

    const out = Buffer.from(base);
    for (const [part, hex] of Object.entries(paint)) {
      const f = OUT + `mask_${part}.png`;
      if (!fs.existsSync(f)) throw new Error(`${name}: ${part} 마스크가 없습니다`);
      const { data: m } = await sharp(f).resize(W, H, { fit:'fill' })
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const col = hex2rgb(hex);
      for (let i = 0; i < W * H; i++) {
        const a = m[i*4+3] / 255; if (!a) continue;
        for (let c = 0; c < 3; c++) {                       // 화면과 같은 곱하기 합성
          const mul = out[i*3+c] * col[c] / 255;
          out[i*3+c] = Math.round(out[i*3+c] * (1-a) + mul * a);
        }
      }
    }
    await sharp(out, { raw:{ width:W, height:H, channels:3 } })
      .extract(crop).resize(w).jpeg({ quality:q, mozjpeg:true }).toFile(OUT + name);
    console.log(`${name.padEnd(16)} ${bf.padEnd(15)} ${String(w).padStart(4)}px  ${Math.round(fs.statSync(OUT+name).size/1024)}KB`);
  }
})();
