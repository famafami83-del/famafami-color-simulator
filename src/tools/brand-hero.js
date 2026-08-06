// ① 표지 맨 위에 까는 침구 사진을 만든다.
//
// 이건 **실제로 찍은 사진**이다. 카드 사진처럼 흰 바탕에 색을 입혀 만든 것이 아니다
// [대표, 2026-08-06]. 그래서 `design-cards.js` 와 따로 떼어 두었다 — 색표도 마스크도
// 필요 없고, 자르고 줄이는 일만 한다.
//
// 가로로 길어야 한다. 세로로 길면 사진만으로 첫 화면이 다 차서 브랜드 글이 안 보인다.
// 아래쪽에 워드마크가 걸쳐 얹히므로 **아래 띠가 어수선하지 않은 자리**를 골라야 한다 —
// 지금 자리는 아래가 흰 매트리스커버라 글자가 잘 앉는다.

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;
const SRC   = 'D:\\01. 파마파미\\00. 디자인\\컬러시뮬레이션\\표지사진.jpg';

// 원본 3024×4032 기준. 베개·이불·꽃이 다 들어오고 아래는 매트리스커버만 남는 자리.
const CROP = { left: 0, top: 1500, width: 3024, height: 1560 };
// 900px = 폰(430px) 2배 화면까지 덮는다. 더 키워봐야 안 보이고 무겁기만 하다.
const W = 900;
const Q = 76;

(async () => {
  if (!fs.existsSync(SRC))
    throw new Error(`표지 사진 원본이 없습니다: ${SRC}`);
  const m = await sharp(SRC).metadata();
  if (CROP.left + CROP.width > m.width || CROP.top + CROP.height > m.height)
    throw new Error(`CROP 이 원본(${m.width}×${m.height}) 밖으로 나갑니다`);

  const f = OUT + 'hero.jpg';
  await sharp(SRC).extract(CROP).resize({ width: W })
    .jpeg({ quality: Q, mozjpeg: true }).toFile(f);
  console.log(`hero.jpg  ${W}px  ${(CROP.width/CROP.height).toFixed(2)}:1  `
    + Math.round(fs.statSync(f).size/1024) + 'KB');
})();
