// 날개형 구도의 바탕 사진과 부위 마스크 다섯 장을 뽑는다.
//
//   node src/tools/extract-wing.js
//
// 사진 **네 장을 각각 다른 일에** 쓴다. 헷갈리면 안 되니 적어둔다.
//
//   NEUTRAL — 페이지에 깔 **바탕**. 협력업체(프린톤) 납품 원본이다.
//     침구가 **완전한 중성 회색(R=G=B)** 이라 곱하기로 색을 얹으면 고른 색이 그대로 나온다.
//     [2026-08-09] 이걸 찾기 전에는 (바탕-화이트).jpg 를 바탕으로 썼는데, 그건 날개만
//     하얗게 칠하고 나머지는 사진 그대로여서 자리마다 R:G:B 가 기울어 있었다:
//         이불 1.000:0.999:0.975   베개 1.000:0.982:0.945   매트리스 0.976:1.000:1.000
//     그대로 두면 베개는 누렇게, 매트리스는 푸르게 돌았다.
//
//   COLOR — **자리마다 색을 다르게 칠한 컷** [대표, 2026-08-09]. 부위를 가르는 데만 쓰고
//     페이지에는 안 나간다. 이불 주황 / 베개 연보라 / 매트리스 파랑 / 날개 검정,
//     그리고 **뒤에 놓인 베개는 크림**이다.
//     바탕이 중성이라 `사진 ÷ 바탕` 이 그늘을 지우고 **염색 색만** 남긴다.
//     방·바닥·화분은 손대지 않으셔서 두 장이 화소까지 같다 — 그래서 「칠한 자리」를
//     **차이가 있는가**만으로 가려낼 수 있다. 아주 깨끗한 신호다.
//
//   WHITE·BLACK — **날개 마스크에만** 쓰는 한 쌍. 둘은 같은 사진이고 **날개 말고는
//     화소까지 같다.** 색 컷에서도 날개가 갈리지만, 이 한 쌍이 더 깨끗하다 —
//     이웃한 다른 색이 없어 가장자리가 섞이지 않는다.
//
// 부위를 가르는 방법 — 씨앗을 박아두고 제일 가까운 것으로 붙인다. `SEEDS` 는 실제
//   사진에서 잰 값이다. **사진을 다시 찍거나 칠한 색을 바꾸면 다시 재야 한다.**

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;
const SRC   = 'D:\\01. 파마파미\\00. 디자인\\컬러시뮬레이션\\';
const DLV   = 'D:\\01. 파마파미\\06. 협력업체\\프린톤(컬러칩작업)\\납품\\시뮬레이션용이미지\\날개형\\';

const NEUTRAL = DLV + '날개형_시뮬레이션용_원본.tif';          // 침구가 중성 회색인 원본
const COLOR   = SRC + '날개형.jpg';                            // 자리마다 색이 다른 컷
const BASE    = SRC + '날개형_시뮬레이션용 (바탕-화이트).jpg';   // 날개가 흰색인 컷
const BLACK   = SRC + '날개(검정).jpg';                        // 날개만 검정인 컷
// ※ 같은 폴더의 `날개형_시뮬레이션용2_원본.tif` 는 **다른 구도**다 (창이 오른쪽, 더 가깝다).
//   이 구도에는 색 사진이 없으므로 지금은 쓰지 않는다.

const OUT_W = 1200;
// ── 날개: 밝기가 바탕의 몇 배인가. 1.0 이면 안 변한 자리, 0 에 가까우면 새까매진 자리.
// 사이 구간을 알파로 부드럽게 깔아야 2px 짜리 가장자리가 계단으로 안 보인다.
const HI = 0.86;   // 이 위는 날개가 아니다
const LO = 0.42;   // 여기까지 떨어지면 순수한 날개

// ── 부위: 색 컷과 바탕의 **비율**(사진 ÷ 바탕)로 가른다. 실제 사진에서 잰 값이다.
//   부위 이름은 `build.js` 의 PARTS 키와 같아야 한다 — 마스크 파일 이름이 거기서 나온다.
const SEEDS = {
  wQuilt:   [0.97, 0.64, 0.22],   // 이불   — 주황
  wPillow:  [0.76, 0.65, 0.78],   // 베개   — 연보라
  wMat:     [0.57, 0.61, 0.73],   // 매트리스 — 파랑
  wPillowB: [0.97, 0.95, 0.86],   // 뒤에 놓인 베개 — 크림
};
// 「칠한 자리인가」는 두 사진의 **차이 크기**로 본다. 방·바닥은 손대지 않으셔서
// 차이가 0 에 가깝다. JPEG 잡티가 몇 단계 있으므로 그보다 위에서 끊는다.
const D_LO = 8;    // 여기 아래는 안 칠한 것으로 본다
const D_HI = 25;   // 여기 위는 확실히 칠한 것

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

(async () => {
  for (const f of [NEUTRAL, COLOR, BASE, BLACK])
    if (!fs.existsSync(f)) throw new Error(`원본이 없습니다: ${f}`);

  const load = async f => sharp(f, { limitInputPixels: false, unlimited: true })
    .resize(OUT_W).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: W, info } = await load(BASE);
  const { data: K, info: iK } = await load(BLACK);
  if (info.width !== iK.width || info.height !== iK.height)
    throw new Error('두 사진의 크기가 다릅니다 — 같은 구도로 내보내셨는지 보십시오');

  const w = info.width, h = info.height, n = w * h;
  const alpha = Buffer.alloc(n);
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const lw = lum(W[i*3], W[i*3+1], W[i*3+2]);
    const lk = lum(K[i*3], K[i*3+1], K[i*3+2]);
    // 바탕이 이미 어두운 자리(그늘·나무 바닥)는 비율이 요동친다. 밝은 데만 본다.
    if (lw < 60) continue;
    const r = lk / lw;
    const a = r >= HI ? 0 : r <= LO ? 1 : (HI - r) / (HI - LO);
    alpha[i] = Math.round(a * 255);
    if (a > 0.5) hit++;
  }

  // 마스크는 **흰색 RGB + 알파**로 낸다. 흑백 그림으로 두면 브라우저가 무시해서
  // 색을 눌러도 아무 일이 안 일어난다 (`alpha-masks.js` 와 같은 규칙).
  const writeMask = async (name, a) => {
    const rgba = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = 255;
      rgba[i*4+3] = a[i];
    }
    await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 9 }).toFile(OUT + `mask_${name}.png`);
  };
  await writeMask('wWing', alpha);
  // 바탕은 **중성 원본**으로 낸다. 마스크를 뽑은 사진과 다른 파일이지만 자리가 같다.
  await sharp(NEUTRAL, { limitInputPixels: false, unlimited: true })
    .resize(OUT_W).jpeg({ quality: 82, mozjpeg: true }).toFile(OUT + 'base_wing.jpg');

  /* ── 나머지 부위 — 색 컷과 바탕의 비율로 가른다 ─────────────────────── */
  const { data: C } = await load(COLOR);
  const { data: N } = await load(NEUTRAL);
  const names = Object.keys(SEEDS);
  const masks = Object.fromEntries(names.map(k => [k, Buffer.alloc(n)]));
  const count = Object.fromEntries(names.map(k => [k, 0]));
  let painted = 0;
  for (let i = 0; i < n; i++) {
    const nb = [N[i*3], N[i*3+1], N[i*3+2]];
    // 어두운 자리(바닥·그늘)는 비율이 요동친다. 밝은 데만 본다.
    if (lum(nb[0], nb[1], nb[2]) < 45) continue;
    // 날개는 이미 더 깨끗한 한 쌍에서 뽑았다. 여기서 또 잡으면 가장자리가 겹친다.
    if (alpha[i] > 96) continue;
    const cb = [C[i*3], C[i*3+1], C[i*3+2]];
    const d = Math.max(...[0,1,2].map(c => Math.abs(cb[c] - nb[c])));
    const a = clamp((d - D_LO) / (D_HI - D_LO), 0, 1);
    if (!a) continue;
    painted++;
    const ratio = [0,1,2].map(c => clamp(cb[c] / Math.max(nb[c], 1), 0, 1.6));
    let best = null, bestD = Infinity;
    for (const k of names) {
      const s = SEEDS[k];
      const dd = [0,1,2].reduce((t, c) => t + (ratio[c]-s[c])**2, 0);
      if (dd < bestD) { bestD = dd; best = k; }
    }
    // 날개가 반쯤 걸린 자리는 남은 몫만 준다. 안 그러면 두 마스크가 겹쳐 색이 두 번 곱해진다.
    const left = 1 - alpha[i] / 255;
    masks[best][i] = Math.round(a * left * 255);
    if (a * left > 0.5) count[best]++;
  }

  // 바탕이 정말 중성인지 확인한다. 기울어 있으면 고른 색이 그대로 안 나온다 —
  // **조용히 어긋난 색이 나가는 것**이 이 페이지에서 제일 나쁜 일이라 여기서 잡는다.
  const { data: B } = await sharp(OUT + 'base_wing.jpg').removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let off = 0, seen = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i]) continue;                       // 날개는 뺀다
    const r = B[i*3], g = B[i*3+1], b = B[i*3+2];
    if (r < 120) continue;                        // 어두운 자리(바닥·그늘)는 흔들린다
    seen++;
    if (Math.max(r,g,b) - Math.min(r,g,b) > 6) off++;
  }
  const pct = off / seen * 100;

  for (const k of names) await writeMask(k, masks[k]);

  const KO = { wQuilt:'이불', wPillow:'베개', wMat:'매트리스커버', wPillowB:'뒤 베개' };
  const kb = f => Math.round(fs.statSync(OUT + f).size / 1024);
  console.log(`base_wing.jpg    ${w}×${h}  ${kb('base_wing.jpg')}KB   (중성 원본)`);
  console.log(`mask_wWing.png   ${'날개'.padEnd(6)} ${(hit / n * 100).toFixed(2).padStart(5)}%  ${kb('mask_wWing.png')}KB`);
  for (const k of names)
    console.log(`mask_${k}.png`.padEnd(17) + `${KO[k].padEnd(6)} ${(count[k] / n * 100).toFixed(2).padStart(5)}%  ${kb(`mask_${k}.png`)}KB`);
  console.log(`칠한 자리 합계 ${(painted / n * 100).toFixed(1)}%`);
  console.log(`바탕의 색 치우침  밝은 화소 중 ${pct.toFixed(1)}% 가 중성에서 벗어남 (방·화분·창은 원래 색이 있다)`);
})();
