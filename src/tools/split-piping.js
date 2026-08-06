// 양면 디자인의 사진과 마스크를 뽑는다 — 「삥」 구도.
//
// 무지와 **사진이 다르다.** 무지는 침대를 옆에서 본 컷이고, 이쪽은 위에서 비스듬히 본
// 세로 컷이다. 그래서 마스크도 따로고, 페이지에 사진이 한 장 더 들어간다.
//
// 왜 이 구도로 갈아탔나 — 이 컷은 **베개의 앞뒤가 한 장에 같이 보인다.**
// 뒤 베개는 겉이 이불 앞면색이고, 앞 베개는 겉이 뒷면색이라 젖혀 놓은 모양이다.
// 무지 컷은 베개 네 개가 다 윗면만 보여서 양면 베개를 흉내낼 수가 없었다. [대표, 2026-08-06]
//
// 맞바꾼 것 — **이불과 베개를 따로 못 고른다.** 색 사진 세 장이 전부 베개를 이불과 같은
// 색으로 칠해놔서, 색이 어떻게 변하는지로는 둘을 가를 수가 없다. 대표가 원한 것이
// 「이불 바탕을 바꾸면 베개도 같이 바뀌는 것」이라 그대로 두었다. [대표, 2026-08-06]
//
// 가르는 방법 — 바탕이 **흰색**이라 「사진 ÷ 바탕」 을 하면 주름 그늘이 지워지고 염색 색만
// 남는다. 세 장을 이어 붙인 9차원 값이 부위마다 다른 지문이 된다.
// 무지 쪽(extract-masks.js)은 흰 바탕이 없어 p95 로 바탕을 지어냈다. 이쪽이 훨씬 깨끗하다.
//
// 삥은 따로 잡는다 — 세 장 중 `양면.jpg` 에서만 삥이 남색(아주 어둡다)이라, 밝기비가
// 얼마나 떨어지는지로 알파를 매기면 2px 짜리 얇은 선도 계단 없이 뽑힌다.

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
const OUT   = path.join(__dirname, '..', 'assets') + path.sep;
const SRC   = 'D:\\01. 파마파미\\00. 디자인\\컬러시뮬레이션\\';

const BASE  = '삥_시뮬레이션_(바탕).jpg';       // 침구가 전부 흰색인 컷
// 순서를 지킬 것 — SEED 와 WARM_SHOT 이 이 순서를 전제로 한다.
const SHOTS = [
  '매트리스(아이보리)+이불(메로나)+라인(노랑).jpg',
  '양면.jpg',
  '양면1.jpg',
];
const WARM_SHOT = 1;      // `양면.jpg` — 겉면이 민트, 안면이 크림이라 붉은기로 앞뒤를 가른다

const OUT_W = 1200;
const BED     = 0.06;     // 배경과 침구를 가르는 문턱. 배경은 세 장에서 변동이 0.00 이다
const PIP_HI  = 0.78;     // 밝기비가 이 위면 천, 아래면 삥이 섞이기 시작한다
const PIP_LO  = 0.34;     // 여기까지 떨어지면 순수한 삥
const PIP_CUT = 0.35;     // 이보다 삥기가 세면 천 덩어리 계산에서 뺀다
const MIN_PX  = 5000;     // 이보다 작은 덩어리가 나오면 갈린 게 아니다

// 부위별 씨앗 = 세 장에서의 (r,g,b) 비율. 눈으로 찍은 값이 아니라
// 같은 자료를 10 덩어리로 갈라봤을 때 나온 덩어리 색이다.
const SEED = {
  bothA: [[0.905,0.910,0.733],[0.776,0.851,0.820],[0.905,0.910,0.733]],  // 앞면(겉) — 이불 본체 + 뒤 베개 겉
  bothB: [[0.905,0.910,0.733],[0.988,0.957,0.886],[0.973,0.953,0.843]],  // 뒷면(안) — 젖혀진 면 + 앞 베개 겉
  bothM: [[0.984,0.957,0.882],[0.996,0.996,0.996],[0.984,0.957,0.882]],  // 매트리스커버
};
const KEYS = Object.keys(SEED);
const LUM = (r, g, b) => 0.299*r + 0.587*g + 0.114*b;

(async () => {
  for (const f of [BASE, ...SHOTS])
    if (!fs.existsSync(SRC + f)) throw new Error(`원본 사진이 없습니다: ${SRC}${f}`);

  const b = await sharp(SRC + BASE).resize({ width: OUT_W }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const W = b.info.width, H = b.info.height, N = W * H;
  const base = b.data;
  const shots = [];
  for (const f of SHOTS)
    shots.push(await sharp(SRC + f).resize(W, H, { fit:'fill' }).removeAlpha().raw().toBuffer());
  console.log(`${W}x${H}  바탕 ${BASE}`);

  // 사진 ÷ 바탕 → 9차원 지문. 그늘이 나눠져 사라지므로 같은 천은 어디서나 같은 값이 된다.
  const ratio = new Float32Array(N * 9);
  const dev = new Float32Array(N), pip = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    let mx = 0, lmin = 9;
    for (let s = 0; s < 3; s++) {
      const v = [];
      for (let c = 0; c < 3; c++) {
        const bb = base[p*3+c];
        const r = bb < 24 ? 1 : shots[s][p*3+c] / bb;   // 너무 어두우면 나눗셈이 폭주한다
        ratio[p*9+s*3+c] = r; v.push(r);
        const d = Math.abs(r - 1); if (d > mx) mx = d;
      }
      const l = LUM(v[0], v[1], v[2]); if (l < lmin) lmin = l;
    }
    dev[p] = mx;
    pip[p] = Math.max(0, Math.min(1, (PIP_HI - lmin) / (PIP_HI - PIP_LO)));
  }

  const idx = []; for (let p = 0; p < N; p++) if (dev[p] > BED) idx.push(p);
  if (idx.length < N * 0.2)
    throw new Error(`침구가 ${(idx.length/N*100).toFixed(1)}% 밖에 안 잡혔습니다 — 바탕과 색 사진의 구도가 다릅니다`);
  console.log(`침구 ${idx.length}px (${(idx.length/N*100).toFixed(1)}%)`);

  // 삥이 아닌 화소를 세 덩어리로. 씨앗이 SEED 라 덩어리 번호가 뒤섞이지 않는다.
  const D = 9, K = KEYS.length;
  const cen = KEYS.map(k => SEED[k].flat());
  const fab = idx.filter(p => pip[p] < PIP_CUT);
  const lab = new Int8Array(N).fill(-1);
  for (let it = 0; it < 20; it++) {
    const sum = Array.from({length:K}, () => new Float64Array(D)), cnt = new Int32Array(K);
    for (const p of fab) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) {
        let d = 0; for (let j = 0; j < D; j++) { const t = ratio[p*9+j] - cen[k][j]; d += t*t; }
        if (d < bd) { bd = d; best = k; }
      }
      lab[p] = best; cnt[best]++;
      for (let j = 0; j < D; j++) sum[best][j] += ratio[p*9+j];
    }
    for (let k = 0; k < K; k++) {
      if (cnt[k] < MIN_PX)
        throw new Error(`${KEYS[k]} 덩어리가 ${cnt[k]}px 뿐입니다 — 세 장이 같은 구도인지 확인하십시오`);
      for (let j = 0; j < D; j++) cen[k][j] = sum[k][j] / cnt[k];
    }
  }

  // 앞면/뒷면 — `양면.jpg` 에서 붉은기가 **적은** 쪽이 겉면(민트)이다.
  // 씨앗을 제대로 줬으면 안 뒤집히지만, 사진이 바뀌면 조용히 뒤집히므로 여기서 다시 본다.
  const warm = k => { const c = cen[k], o = WARM_SHOT*3; return c[o] / (c[o]+c[o+1]+c[o+2]); };
  const iA = KEYS.indexOf('bothA'), iB = KEYS.indexOf('bothB');
  if (warm(iA) > warm(iB)) {
    [cen[iA], cen[iB]] = [cen[iB], cen[iA]];
    for (const p of fab) lab[p] = lab[p] === iA ? iB : lab[p] === iB ? iA : lab[p];
    console.log('앞뒤를 뒤집었습니다 — 사진이 바뀌었는지 확인하십시오');
  }

  // 알파 = 그 덩어리 색이 얼마나 진하게 나타나는가. 가장자리는 배경이 섞여 옅다.
  // 안쪽 값을 그대로 두면 254·253·255 로 자글거려 PNG 가 열 배로 커진다. 딱 붙인다.
  const snap = v => v > 0.86 ? 255 : v < 0.14 ? 0 : Math.round(v * 255);
  const full = KEYS.map((_, k) => cen[k].reduce((m, v) => Math.max(m, Math.abs(v - 1)), 0));
  const mask = {}; for (const k of KEYS) mask[k] = Buffer.alloc(N);
  const mpip = Buffer.alloc(N);
  for (let p = 0; p < N; p++) {
    mpip[p] = snap(pip[p]);
    const k = lab[p]; if (k < 0) continue;
    mask[KEYS[k]][p] = snap(Math.min(1, dev[p] / full[k]) * (1 - pip[p]));   // 삥과 겹치지 않게 깎는다
  }

  const write = async (key, buf) => {
    const rgba = Buffer.alloc(N * 4); let on = 0;
    for (let p = 0; p < N; p++) {
      rgba[p*4] = rgba[p*4+1] = rgba[p*4+2] = 255;
      rgba[p*4+3] = buf[p];
      if (buf[p] > 127) on++;
    }
    if (on < MIN_PX) throw new Error(`mask_${key}.png 가 ${on}px 뿐입니다`);
    const f = OUT + `mask_${key}.png`;
    await sharp(rgba, { raw:{ width:W, height:H, channels:4 } }).png({ compressionLevel:9 }).toFile(f);
    console.log(`mask_${key}.png`.padEnd(20), String(on).padStart(7) + 'px',
      Math.round(fs.statSync(f).size/1024) + 'KB');
  };
  for (const k of KEYS) await write(k, mask[k]);
  await write('bothP', mpip);

  // 바탕 사진. 무지 쪽 base.jpg 와 같은 품질로 맞춘다 (src/tools/README.md 참조).
  const bf = OUT + 'base_both.jpg';
  await sharp(SRC + BASE).resize({ width: OUT_W }).jpeg({ quality:82, mozjpeg:true }).toFile(bf);
  console.log('base_both.jpg'.padEnd(20), ' '.repeat(9) + Math.round(fs.statSync(bf).size/1024) + 'KB');
})();
