// 디자인 고르는 카드에 넣을 작은 사진 2장을 만든다.
// 둘 다 같은 색표(C)를 쓴다. 색을 따로 적어두면 대표가 색을 바꿀 때 한쪽만 바뀐다.
//
// 카드는 **디자인끼리 무엇이 다른지**만 보여주면 된다. 그래서 두 장에 같은 색을 쓴다 —
// 이불은 아몬드 밀크, 매트리스커버는 베링씨. 색을 여기저기 다르게 칠하면
// 「어느 쪽이 예쁜가」를 고르게 되어 디자인 차이가 묻힌다.
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
  q901:  '#f1ebdb',   // NO. 901  아몬드 밀크 80수    — 이불(앞면)
  m939:  '#556378',   // NO. 939  베링씨 80수         — 매트리스커버
  p952:  '#f5f4ef',   // NO. 952  멜트 아이스크림 60수 — 베개
  p2006: '#c2d1ca',   // NO. 2006 블루 헤이즈 100수   — 베개
  p970:  '#c1beab',   // NO. 970  카키 그레이지 60수   — 베개
  b2012: '#c1dee6',   // NO. 2012 아쿠아 에스케 100수  — 양면 뒷면 [대표, 2026-08-06 확정]
};
// 무지 카드의 베개 네 칸은 일부러 섞었다 — **한 장씩 따로 고를 수 있다**는 것이
// 카드에서부터 보인다. 양면 카드에는 이 자유가 없다(베개가 이불을 따라간다).
const PILLOWS = { pillowF:C.p952, pillowR:C.p2006, pillowL:C.p970, pillowW:C.p952 };

const BOTH = { bothA:C.q901, bothB:C.b2012, bothM:C.m939, bothP:C.q901 };

const SHOTS = {
  // base.jpg(1200×1500) — 이불 앞면(왼쪽 아래)과 베개 네 개가 들어오는 자리.
  // 폰에서 두 칸 그리드면 카드 하나가 175px 남짓, 2배 화면이라 350px 이면 충분하다.
  'card_plain.jpg': { base:'base.jpg', w:520, q:76,
    crop:{ left:0, top:500, width:1000, height:1000 },
    paint:{ quilt:C.q901, mattress:C.m939, ...PILLOWS } },
  // base_both.jpg(1200×1600) — 베개 둘과 젖혀진 이불이 다 들어와야 양면인 게 보인다.
  // 삥은 앞면과 같은 색으로 덮어 안 보이게 한다. 페이지에서도 그렇게 쓴다.
  'card_both.jpg':  { base:'base_both.jpg', w:520, q:76,
    crop:{ left:80, top:400, width:1120, height:1120 }, paint:BOTH },
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
