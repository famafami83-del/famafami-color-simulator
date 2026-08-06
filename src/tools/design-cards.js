// 디자인 고르는 카드에 넣을 작은 사진을 만든다.
//
// 카드는 **디자인끼리 무엇이 다른지**만 보여주면 된다. 그래서 두 장 모두 같은 사진,
// 같은 색으로 칠하고 **이불 뒷면만** 다르게 둔다 — 무지는 앞뒤가 같은 색,
// 양면은 젖혀진 면이 다른 색. 카드끼리 견주면 차이가 그것 하나로 보인다.
// 색을 여기저기 다르게 칠하면 「어느 쪽이 예쁜가」를 고르게 되어 디자인 차이가 묻힌다.
//
// 자르는 자리 — 이불 앞면과 젖혀진 뒷면이 둘 다 들어가야 한다. 침대 전체를 담으면
// 작은 카드에서 이불이 너무 작아져 차이가 안 보인다.

const sharp = require('sharp');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;

// 색은 대표가 정한 것이다 [대표, 2026-08-06]. 팔레트에 실제로 있는 번호를 쓴다 —
// 카드에만 있는 색을 칠하면 손님이 그 색을 찾다가 없다.
const C = {
  q901:  '#f1ebdb',   // NO. 901  아몬드 밀크 80수    — 이불
  m939:  '#556378',   // NO. 939  베링씨 80수         — 매트리스커버
  p952:  '#f5f4ef',   // NO. 952  멜트 아이스크림 60수 — 베개
  p2006: '#c2d1ca',   // NO. 2006 블루 헤이즈 100수   — 베개
  p970:  '#c1beab',   // NO. 970  카키 그레이지 60수   — 베개
  b2012: '#c1dee6',   // NO. 2012 아쿠아 에스케 100수  — 양면 뒷면 (★ 아직 임시. 대표 확정 대기)
};
// 베개는 네 칸을 일부러 섞었다 — **한 장씩 따로 고를 수 있다**는 것이 카드에서부터 보인다.
const PILLOWS = { pillowF:C.p952, pillowR:C.p2006, pillowL:C.p970, pillowW:C.p952 };

const CARDS = {
  'card_plain.jpg': { quilt:C.q901,  mattress:C.m939, ...PILLOWS },
  'card_both.jpg':  { quiltA:C.q901, quiltB:C.b2012, mattress:C.m939, ...PILLOWS },
};

// base.jpg(1200×1500) 기준 정사각. 이불 앞면(왼쪽 아래)과 젖혀진 띠(가운데)가 둘 다 들어와야
// 양면 카드에서 「두 색」이 보인다. 침대 전체를 담으면 작은 카드에서 이불이 너무 작아진다.
const CROP = { left:0, top:500, width:1000, height:1000 };
// 폰에서 두 칸 그리드면 카드 하나가 175px 남짓, 2배 화면이라 350px 이면 충분하다.
const CARD_W = 520;

const hex2rgb = h => [1,3,5].map(i => parseInt(h.substr(i,2),16));

(async () => {
  const { data: base, info } = await sharp(OUT + 'base.jpg').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  for (const [name, paint] of Object.entries(CARDS)) {
    const out = Buffer.from(base);
    for (const [part, hex] of Object.entries(paint)) {
      const { data: m } = await sharp(OUT + `mask_${part}.png`).resize(W, H, { fit:'fill' })
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
      .extract(CROP).resize(CARD_W).jpeg({ quality:76, mozjpeg:true }).toFile(OUT + name);
    const kb = (require('fs').statSync(OUT + name).size / 1024).toFixed(0);
    console.log(`${name}  ${CARD_W}px  ${kb}KB`);
  }
})();
