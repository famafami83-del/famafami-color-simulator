const sharp = require('sharp');
const OUT = require('path').join(__dirname,'..','assets') + require('path').sep;
const PARTS = ['quilt','mattress','pillowL','pillowF','pillowR','pillowW'];

// 원본 '무지- 이불2006번 베개 914번.jpg' 를 재현: 이불 민트, 매트리스 베이지, 베개 민트/베이지/민트/크림
const TEST = {
  quilt:'#c3d5cd', mattress:'#c6b5a3', pillowL:'#c3d5cd',
  pillowF:'#c6b5a3', pillowR:'#c3d5cd', pillowW:'#f2ecdc',
};

const hex2rgb = h => [1,3,5].map(i => parseInt(h.substr(i,2),16));

(async () => {
  const { data: base, info } = await sharp(OUT+'base.jpg').removeAlpha().raw().toBuffer({resolveWithObject:true});
  const W = info.width, H = info.height;
  const out = Buffer.from(base);

  for (const p of PARTS) {
    // 마스크는 흰색 RGB + 알파 채널. CSS mask-mode:alpha 와 같게 알파를 읽는다
    const { data: m } = await sharp(OUT+`mask_${p}.png`).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const col = hex2rgb(TEST[p]);
    for (let i = 0; i < W*H; i++) {
      const a = m[i*4+3] / 255; if (!a) continue;
      for (let c = 0; c < 3; c++) {
        const mul = out[i*3+c] * col[c] / 255;          // multiply
        out[i*3+c] = Math.round(out[i*3+c]*(1-a) + mul*a);
      }
    }
  }
  await sharp(out,{raw:{width:W,height:H,channels:3}}).jpeg({quality:88}).toFile('verify.jpg');
  console.log('wrote verify.jpg', W+'x'+H);
})();
