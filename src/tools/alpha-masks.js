const sharp = require('sharp');
const OUT = require('path').join(__dirname,'..','assets') + require('path').sep;
const PARTS = ['quilt','mattress','pillowL','pillowF','pillowR','pillowW'];

(async () => {
  for (const p of PARTS) {
    const f = OUT + `mask_${p}.png`;
    const { data, info } = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const rgba = Buffer.alloc(W * H * 4);
    let on = 0;
    for (let i = 0; i < W * H; i++) {
      rgba[i*4] = 255; rgba[i*4+1] = 255; rgba[i*4+2] = 255;
      rgba[i*4+3] = data[i];              // 알파 = 마스크값
      if (data[i] > 127) on++;
    }
    await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .png({ compressionLevel: 9 }).toFile(f);
    console.log(`mask_${p}.png  ${W}x${H}  alpha px=${on}`);
  }
})();
