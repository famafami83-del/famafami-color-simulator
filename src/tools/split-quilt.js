// 이불 마스크를 앞면 / 뒷면으로 가른다 — 양면 디자인용.
//
// 배경 사진은 무지와 **똑같은 사진**이다. 양면 렌더 3장은 무지 3장과 같은 원본에서
// 이불 색만 바꿔 뽑은 것이라 벽·바닥·창문 픽셀이 정확히 0 차이다.
// 그래서 새 사진도, 새 매트리스·베개 마스크도 필요 없다. 이불만 둘로 가르면 된다.
//
// 가르는 방법 — 세 장에서 색이 어떻게 변하는지로 나눈다. 깔린 면과 젖혀진 면은
// 장마다 다른 색이 칠해져 있어, 세 장의 색을 이어붙인 9차원 값으로 2-means 하면 갈린다.
// 밝기는 빼고 **색도**만 본다. 같은 천이라도 주름 그늘 때문에 밝기는 크게 달라진다.
//
// 어느 쪽이 뒷면인가 — 파일 이름이 알려준다. `앞면(901번 아이보리) 뒷면(2012 블루)` 에서
// 뒷면만 파랗다. 그 장에서 파란 기가 더 센 덩어리가 뒷면이다.
// 앞면/뒷면 색이 둘 다 따뜻한 장(버터·핑크)으로 판별하면 뒤집힐 수 있어 이 장을 쓴다.

const sharp = require('sharp');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;
const SRC   = 'D:\\01. 파마파미\\00. 디자인\\컬러시뮬레이션\\';

// 순서를 지킬 것 — 마지막 장의 파란 기로 앞뒤를 가른다.
const SHOTS = [
  '무지(양면) _ 이불(963번 메론 + 2003번 아이보리).jpg',
  '앞면(2013번버터) 뒷면(906번 핑크) 양면이불.jpg',
  '앞면(901번 아이보리) 뒷면(2012 블루) 양면이불.jpg',   // ← 뒷면만 파랗다
];
const BLUE_SHOT = 2;

const MAJORITY_PASSES = 3;   // 얼룩 지우기. 너무 많이 돌리면 접힌 선이 뭉개진다.

(async () => {
  const src = await sharp(OUT + 'mask_quilt.png').metadata();
  const W = src.width, H = src.height;

  // 이불 마스크의 알파. 가장자리는 반투명이라 그 값을 그대로 물려준다.
  const qa = await sharp(OUT + 'mask_quilt.png').ensureAlpha().extractChannel(3).raw().toBuffer();

  const shots = [];
  for (const f of SHOTS)
    shots.push(await sharp(SRC + f).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer());

  // 마스크 안 픽셀만 모은다.
  // core = 알파가 꽉 찬 픽셀. 가장자리 반투명 픽셀은 배경색이 섞여 있어 덩어리를 찾을 때는 빼고,
  // 나중에 가까운 쪽으로 붙인다. 안 그러면 씨앗이 가장자리에 잡혀 엉뚱하게 갈린다.
  const D = 9;
  const idx = [], vec = [], core = [];
  for (let p = 0; p < W * H; p++) {
    if (!qa[p]) continue;
    const v = [];
    for (const d of shots) {
      const r = d[p*3], g = d[p*3+1], b = d[p*3+2], s = r + g + b + 1;
      v.push(r/s, g/s, b/s);                    // 색도 — 밝기를 나눠 없앤다
    }
    if (qa[p] >= 250) core.push(vec.length);
    idx.push(p); vec.push(v);
  }
  if (!idx.length) throw new Error('이불 마스크가 비어 있습니다');

  // 씨앗 — 색이 가장 크게 갈리는 축(주성분)을 찾아 그 축의 양 끝을 쓴다.
  // 아무 픽셀이나 둘 집으면 둘 다 같은 면에 떨어질 수 있고, 그러면 한 덩어리로 뭉친다.
  const mean = new Float64Array(D);
  for (const i of core) for (let j = 0; j < D; j++) mean[j] += vec[i][j] / core.length;
  let ax = new Float64Array(D).fill(1 / Math.sqrt(D));
  for (let it = 0; it < 30; it++) {            // 거듭제곱법 — 공분산행렬을 만들지 않고 주축을 얻는다
    const nx = new Float64Array(D);
    for (const i of core) {
      let dot = 0;
      for (let j = 0; j < D; j++) dot += (vec[i][j] - mean[j]) * ax[j];
      for (let j = 0; j < D; j++) nx[j] += (vec[i][j] - mean[j]) * dot;
    }
    let n = Math.hypot(...nx); if (!n) break;
    for (let j = 0; j < D; j++) nx[j] /= n;
    ax = nx;
  }
  let lo = null, hi = null, loV = Infinity, hiV = -Infinity;
  for (const i of core) {
    let t = 0; for (let j = 0; j < D; j++) t += (vec[i][j] - mean[j]) * ax[j];
    if (t < loV) { loV = t; lo = i; }
    if (t > hiV) { hiV = t; hi = i; }
  }

  let c0 = vec[lo].slice(), c1 = vec[hi].slice();
  const lab = new Uint8Array(vec.length);
  for (let it = 0; it < 60; it++) {
    const s0 = new Float64Array(D), s1 = new Float64Array(D);
    let n0 = 0, n1 = 0, moved = 0;
    for (let i = 0; i < vec.length; i++) {
      let d0 = 0, d1 = 0;
      for (let j = 0; j < D; j++) { d0 += (vec[i][j]-c0[j])**2; d1 += (vec[i][j]-c1[j])**2; }
      const l = d0 <= d1 ? 0 : 1;
      if (l !== lab[i]) moved++;
      lab[i] = l;
      const s = l ? s1 : s0; for (let j = 0; j < D; j++) s[j] += vec[i][j];
      l ? n1++ : n0++;
    }
    if (!n0 || !n1) throw new Error('한 덩어리로만 뭉쳤습니다 — 세 장이 같은 구도인지 확인하십시오');
    for (let j = 0; j < D; j++) { c0[j] = s0[j]/n0; c1[j] = s1[j]/n1; }
    if (!moved) break;
  }
  // 한쪽이 부스러기만 남으면 갈린 게 아니라 잘못 갈린 것이다. 조용히 넘기면
  // 앞면 하나만 색이 먹는 페이지가 나온다.
  {
    let n1 = 0; for (const l of lab) if (l) n1++;
    const r = Math.min(n1, lab.length - n1) / lab.length;
    if (r < 0.05) throw new Error(`두 덩어리 크기가 ${(r*100).toFixed(1)}% : ${(100-r*100).toFixed(1)} 로 치우쳤습니다 — 갈리지 않았습니다`);
  }

  // 얼룩 지우기 — 이웃 다수를 따른다. 마스크 밖은 세지 않는다.
  const at = new Int32Array(W * H).fill(-1);
  idx.forEach((p, i) => at[p] = i);
  for (let pass = 0; pass < MAJORITY_PASSES; pass++) {
    const next = lab.slice();
    for (let i = 0; i < idx.length; i++) {
      const p = idx[i], x = p % W, y = (p / W) | 0;
      let one = 0, all = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = at[ny * W + nx]; if (j < 0) continue;
        all++; if (lab[j]) one++;
      }
      next[i] = one * 2 > all ? 1 : 0;
    }
    lab.set(next);
  }

  {
    let n1 = 0; for (const l of lab) if (l) n1++;
    console.log(`이불 ${lab.length}px → ${lab.length - n1} / ${n1}`);
  }

  // 어느 덩어리가 뒷면인가 — 파란 장에서 파란 기가 더 센 쪽
  let blue = [0, 0], cnt = [0, 0];
  for (let i = 0; i < idx.length; i++) {
    const p = idx[i], d = shots[BLUE_SHOT];
    const r = d[p*3], g = d[p*3+1], b = d[p*3+2];
    blue[lab[i]] += b / (r + g + b + 1); cnt[lab[i]]++;
  }
  const backLabel = (blue[0]/cnt[0]) > (blue[1]/cnt[1]) ? 0 : 1;

  const write = async (name, want) => {
    const rgba = Buffer.alloc(W * H * 4);
    let on = 0;
    for (let i = 0; i < idx.length; i++) {
      if (lab[i] !== want) continue;
      const p = idx[i];
      rgba[p*4] = 255; rgba[p*4+1] = 255; rgba[p*4+2] = 255;
      rgba[p*4+3] = qa[p];                     // 바깥 가장자리의 반투명을 그대로 물려받는다
      if (qa[p] > 127) on++;
    }
    await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .png({ compressionLevel: 9 }).toFile(OUT + name);
    console.log(`${name}  ${W}x${H}  alpha px=${on}`);
  };

  await write('mask_quiltA.png', 1 - backLabel);   // 앞면 — 깔린 면
  await write('mask_quiltB.png', backLabel);       // 뒷면 — 젖혀진 면

  // 둘을 합치면 원래 이불 마스크와 같아야 한다. 어긋나면 색이 새거나 빈다.
  let orig = 0, split = 0;
  for (let p = 0; p < W * H; p++) if (qa[p] > 127) orig++;
  for (let i = 0; i < idx.length; i++) if (qa[idx[i]] > 127) split++;
  if (orig !== split) throw new Error(`합계가 안 맞습니다 — 원본 ${orig} / 나뉜 것 ${split}`);
  console.log(`합계 확인 ok — 이불 ${orig}px = 앞면 + 뒷면`);
})();
