const sharp = require('sharp');
const path = require('path');
const A = f => path.join(__dirname, '..', 'assets', f);   // 결과는 src/assets 로
const DIR = 'D:\\01. 파마파미\\00. 디자인\\컬러시뮬레이션\\';
const FILES = ['80수 915번 브라운.jpg', '무지- 이불2006번 베개 914번.jpg', '901-2014.jpg'];
// 배경은 세 장에서 변동이 정확히 0.000이므로 문턱을 낮춰도 섞이지 않는다.
// 0.055로 두면 흰색-민트-흰색처럼 거의 안 변하는 베개가 배경으로 걸러진다 (2026-08-04)
const VAR_THRESHOLD = 0.018;
const OUT_W = 1200;

// 683x854 축소본 기준 시드 좌표 → 비율로 변환해서 어떤 해상도에도 적용
const SEEDS = [
  { key: 'quilt',    label: '이불',          pts: [[128,598],[300,500],[200,700],[90,480],[250,620]] },
  { key: 'mattress', label: '매트리스커버',   pts: [[427,470],[520,470],[380,440],[470,520],[550,430]] },
  { key: 'pillowL',  label: '베개(왼쪽뒤)',   pts: [[150,235],[170,260],[130,215],[190,240]] },
  { key: 'pillowF',  label: '베개(앞중앙)',   pts: [[280,360],[300,340],[260,380],[330,350]] },
  { key: 'pillowR',  label: '베개(오른쪽)',   pts: [[490,320],[510,300],[470,340],[530,320]] },
  { key: 'pillowW',  label: '베개(뒤중앙)',   pts: [[333,235],[345,225],[320,245]] },
];
const SW = 683, SH = 854;

const nrm = (b,i)=>{const r=b[i*3],g=b[i*3+1],bl=b[i*3+2],s=r+g+bl+1;return [r/s,g/s,bl/s];};

(async () => {
  const bufs = [];
  for (const f of FILES) {
    const { data, info } = await sharp(DIR+f).resize({width:OUT_W}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    bufs.push(data); var W=info.width, H=info.height;
  }
  console.log('size', W+'x'+H);

  // 시드 특징 벡터 (6D 색조)
  const seedFeat = SEEDS.map(s => {
    const acc = new Float64Array(6); let n = 0;
    for (const [sx,sy] of s.pts) {
      const x = Math.round(sx/SW*W), y = Math.round(sy/SH*H);
      for (let dy=-3; dy<=3; dy++) for (let dx=-3; dx<=3; dx++) {
        const i = (y+dy)*W + (x+dx); if (i<0||i>=W*H) continue;
        const v = [0,1,2].flatMap(k => { const c = nrm(bufs[k],i); return [c[0],c[1]]; });
        for (let j=0;j<6;j++) acc[j]+=v[j]; n++;
      }
    }
    return Array.from(acc, v => v/n);
  });

  const label = new Int8Array(W*H).fill(-1);
  for (let i=0;i<W*H;i++){
    const n3=[0,1,2].map(k=>nrm(bufs[k],i));
    let v=0; for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){let d=0;for(let c=0;c<3;c++)d+=(n3[a][c]-n3[b][c])**2;v+=Math.sqrt(d);}
    if(v<VAR_THRESHOLD) continue;
    const f=[n3[0][0],n3[0][1],n3[1][0],n3[1][1],n3[2][0],n3[2][1]];
    let bi=0,bd=Infinity;
    for(let s=0;s<seedFeat.length;s++){let d=0;for(let j=0;j<6;j++)d+=(f[j]-seedFeat[s][j])**2; if(d<bd){bd=d;bi=s;}}
    label[i]=bi;
  }

  // 영역별 3장 p95 (밝은쪽 기준색) — base 정규화에 사용
  const p95 = SEEDS.map((_,s) => {
    return [0,1,2].map(k => {
      const ch=[[],[],[]];
      for(let i=0;i<W*H;i+=5){ if(label[i]!==s) continue; for(let c=0;c<3;c++) ch[c].push(bufs[k][i*3+c]); }
      return ch.map(a=>{a.sort((x,y)=>x-y); return a[Math.floor(a.length*0.95)]||255;});
    });
  });

  console.log('\n부위            px       브라운장 p95    민트장 p95     핑크장 p95');
  SEEDS.forEach((s,i)=>{
    let n=0; for(let j=0;j<W*H;j++) if(label[j]===i) n++;
    console.log(s.label.padEnd(15), String(n).padStart(7), ' ', p95[i].map(x=>x.join(',').padEnd(15)).join(''));
  });

  // base: 3장 각각을 자기 영역 p95로 나눈 뒤 중앙값 → 노이즈 감소
  const base = Buffer.alloc(W*H*3);
  for (let i=0;i<W*H;i++){
    const s = label[i];
    if (s < 0) { for(let c=0;c<3;c++) base[i*3+c]=bufs[2][i*3+c]; continue; }
    for (let c=0;c<3;c++){
      const vals=[0,1,2].map(k => bufs[k][i*3+c]/p95[s][k][c]*255).sort((a,b)=>a-b);
      base[i*3+c]=Math.max(0,Math.min(255,Math.round(vals[1])));
    }
  }
  // 품질 82 + mozjpeg — 92 로 두면 394KB 라 페이지가 그만큼 무거워진다. 82 로 낮춰도
  // 화소 평균 차이가 1.9/255 라 눈에 안 보인다. 이 사진은 색을 곱해 얹는 바탕일 뿐이다.
  // split-piping.js 의 base_both.jpg 도 같은 값을 쓴다. [2026-08-06]
  await sharp(base,{raw:{width:W,height:H,channels:3}}).jpeg({quality:82,mozjpeg:true}).toFile(A('base.jpg'));
  console.log('\nwrote base.jpg');

  for(let s=0;s<SEEDS.length;s++){
    const m=Buffer.alloc(W*H);
    for(let i=0;i<W*H;i++) m[i]= label[i]===s?255:0;
    await sharp(m,{raw:{width:W,height:H,channels:1}}).blur(0.6).png({compressionLevel:9}).toFile(A(`mask_${SEEDS[s].key}.png`));
  }
  console.log('wrote 6 masks');

  const PAL=[[230,25,75],[145,30,180],[60,180,75],[245,130,48],[0,130,200],[70,240,240]];
  const seg=Buffer.alloc(W*H*3);
  for(let i=0;i<W*H;i++){ const s=label[i]; if(s<0) continue; for(let c=0;c<3;c++) seg[i*3+c]=PAL[s][c]; }
  await sharp(seg,{raw:{width:W,height:H,channels:3}}).resize({width:600}).png().toFile(A('segments3.png'));
  console.log('wrote segments3.png');
})();
