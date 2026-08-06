// FAMA FAMI 워드마크를 페이지에 쓸 수 있게 다듬는다.
//
// 원본은 **검정 글씨 + 흰 배경**이라 그대로 올리면 어두운 화면에서 흰 네모가 보인다.
// 그래서 밝기를 뒤집어 **알파(투명도)만 있는 그림**으로 만든다. 색은 안 담는다.
// 페이지에서는 CSS 마스크로 얹고 `background-color: currentColor` 를 준다 —
// 그러면 밝은 화면에선 먹색, 어두운 화면에선 크림색으로 **저절로 따라간다.**
// 침구 사진에 색을 입히는 것과 같은 방식이다.
//
// 아래 영문 「INSTITUE OF BEDDING RESEARCH」 는 쓰지 않는다 — INSTITUTE 의 오타다.
// 로고 시트(`02. 브랜드 로고/로고.png`)에 그대로 박혀 있어서, 그 줄이 없는
// 「자사몰 로고.png」 를 원본으로 쓴다. [대표, 2026-08-06]

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;
const SRC   = 'D:\\01. 파마파미\\00. 디자인\\02. 상세페이지\\01. 자사몰 이미지\\자사몰 로고.png';

const W = 900;        // 폰 2배 화면에서 가로로 꽉 채워도 충분하다
const CUT = 200;      // 이보다 밝으면 배경으로 본다 (원본은 검정 글씨/흰 배경)

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`로고 원본이 없습니다: ${SRC}`);

  const { data, info } = await sharp(SRC).flatten({ background:'#fff' }).greyscale()
    .trim({ threshold: 20 })          // 흰 여백을 잘라낸다
    .resize({ width: W })
    .raw().toBuffer({ resolveWithObject: true });

  // 밝기를 뒤집어 알파로. 글씨(어두움)는 불투명, 배경(밝음)은 투명.
  const rgba = Buffer.alloc(info.width * info.height * 4);
  let on = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const a = Math.max(0, Math.min(255, Math.round((CUT - data[i]) * 255 / CUT)));
    rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = 255;
    rgba[i*4+3] = a;
    if (a > 127) on++;
  }
  if (on < info.width * info.height * 0.05)
    throw new Error(`글씨가 ${on}px 뿐입니다 — 원본이 검정 글씨/흰 배경이 맞습니까`);

  const f = OUT + 'logo.png';
  await sharp(rgba, { raw:{ width:info.width, height:info.height, channels:4 } })
    .png({ compressionLevel:9, palette:true }).toFile(f);
  console.log(`logo.png  ${info.width}x${info.height}  글씨 ${on}px  `
    + Math.round(fs.statSync(f).size/1024) + 'KB');
})();
