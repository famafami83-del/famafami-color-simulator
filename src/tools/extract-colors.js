const sharp = require('sharp');
const fs = require('fs');
const CDIR = 'D:\\01. 파마파미\\06. 협력업체\\프린톤(컬러칩작업)\\최종 수정본\\1차수정분\\JPEG\\';

// 컬러차트 13장을 직접 읽어 옮긴 데이터 (2026-08-04)
// rows = 행별 칩 목록, 각 칩 = [번호, 영문명, 한글명, 번수]
const CHART = {
'01_WhiteCream': { ko:'화이트 · 크림', en:'White & Creams', rowY:[0.535,0.9], rows:[
  [['953','Cloud White','클라우드 화이트',60],['903','Cloud White','클라우드 화이트',80]],
  [['952','Melt Icecream','멜트 아이스크림',60],['902','Muslin White','머슬린 화이트',80],['2002','Muslin White','머슬린 화이트',100]],
]},
'02_LightGrey': { ko:'라이트 그레이', en:'Light Grey Scale', rowY:[0.383,0.634,0.909], rows:[
  [['923','Mist Grey','미스트 그레이',80],['924','Mirage Grey','미라지 그레이',80],['976','Illusion Grey','일루션 그레이',60],['2032','Gentle Grey','젠틀 그레이',100]],
  [['925','Neutral Grey','뉴트럴 그레이',80],['972','Shelter Grey','쉘터 그레이',60]],
  [['926','Khaki Grey','카키 그레이',80],['977','Mood Grey','무드 그레이',60],['2026','Night Green','나잇 그린',100]],
]},
'03_DeepGreyscale': { ko:'딥 그레이', en:'Deep Grey Scale', rowY:[0.28,0.448,0.62,0.785,0.955], rows:[
  [['2006','Blue Haze','블루 헤이즈',100],['2025','Aqua Grey','아쿠아 그레이',100],['961','Green Drop','그린 드롭',60],['962','Green Dark Shade','그린 다크 쉐이드',60]],
  [['930','Shadow Green','쉐도우 그린',80]],
  [['940','Green Grey','그린 그레이',80],['978','Quiet Shadow','콰이어트 쉐도우',60],['931','Charcoal','차콜',80],['979','Shadow Grey','쉐도우 그레이',60]],
  [['973','Hearth Grey','하쓰 그레이',60],['910','Evening Haze','이브닝 헤이즈',80],['2023','Cocoa Grey','코코아 그레이',100],['2027','After Dark','애프터 다크',100]],
  [['932','Ebony Black','에보니 블랙',80],['980','Deep Black','딥 블랙',60]],
]},
'04_EarthyRange': { ko:'어시 레인지', en:'Earthy Range', rowY:[0.256,0.428,0.603,0.777,0.949], rows:[
  [['2003','White Cap','화이트 캡',100],['951','Cream White','크림 화이트',60],['901','Almond Milk','아몬드 밀크',80],['2007','Light Peanut Butter','라이트 피넛 버터',100]],
  [['954','Light Skin Beige','라이트 스킨 베이지',60],['912','Warm Sand','웜 샌드',80],['937','Peanut Butter','피넛 버터',80],['955','Calm Beige','캄 베이지',60]],
  [['913','Chinchilla','친칠라',80],['2019','Fine Soil','파인 소일',100],['914','Clams Blacket','클램스 블랭킷',80],['916','Foxtail','폭스테일',80]],
  [['915','Acom Brown','에이컴 브라운',80],['909','Plam Truffle','플람 트러플',80],['969','Cozy Cocoa','코지 코코아',60]],
  [['970','Khaki Greige','카키 그레이지',60],['971','Khaki Beige','카키 베이지',60]],
]},
'05_RedEnergy': { ko:'레드', en:'Red Energy', rowY:[0.864], rows:[
  [['2020','Faded Rose','페이드 로즈',100],['967','Vitamin Sour','비타민 사워',60],['968','Energizing Red','에너자이징 레드',60]],
]},
'06_RoseWine': { ko:'로즈 와인', en:'Rose Wine', rowY:[0.844], rows:[
  [['908','Terracotta','테라코타',80],['2030','Mahogany','마호가니',100],['2022','Red Wine','레드 와인',100],['929','Windsor Wine','윈저 와인',80]],
]},
'07_BurntOrange': { ko:'번트 오렌지', en:'Burnt Oranges', rowY:[0.816], rows:[
  [['936','Copper Blanket','쿠퍼 블랭킷',80],['2015','Spicy Orange','스파이시 오렌지',100],['928','Red Soil','레드 소일',80]],
]},
'08_YellowVitas': { ko:'옐로우', en:'Yellow vitas', rowY:[0.517,0.904], rows:[
  [['2013','Magic Dust','매직 더스트',100],['965','Pollen','폴른',60],['2010','Misted Yellow','미스티드 옐로우',100],['966','Sunlit Yellow','썬릿 옐로우',60]],
  [['2016','Apple Cinnamon','애플 시나몬',100],['918','Harvest Gold','하베스트 골드',80],['919','Plantation','플랜테이션',80]],
]},
'09_AcedTouch': { ko:'에이스드 터치', en:'Aced Touch', rowY:[0.814], rows:[
  [['963','Apple Lime','애플 라임',60],['933','Hazy Lime','헤지 라임',80],['2028','Golden Green','골든 그린',100],['934','Light Olive','라이트 올리브',80]],
]},
'10_GreenWave': { ko:'그린 웨이브', en:'Green Wave', rowY:[0.293,0.494,0.686,0.888], rows:[
  [['2017','Green Moss','그린 모스',100],['920','Olive Khaki','올리브 카키',80],['921','Burnt Olive','번트 올리브',80],['917','Military Olive','밀리터리 올리브',80]],
  [['964','Forest Green','포레스트 그린',60],['2027','Dark Green','다크 그린',100]],
  [['960','Mint Haze','민트 헤이즈',60],['904','Eggshell Blue','에그쉘 블루',80],['927','Harbor Grey','하버 그레이',80],['2005','Green Tea','그린티',100]],
  [['2009','Basil Green','바질 그린',100],['2018','Dark Khaki','다크 카키',100],['922','Olive Night','올리브 나이트',80]],
]},
'11_Blues': { ko:'블루', en:'Blues', rowY:[0.404,0.668,0.931], rows:[
  [['974','Light Sky','라이트 스카이',60],['2012','Aqua-esque','아쿠아 에스케',100],['905','Aquifer','애퀴퍼',80],['938','Dusty Blue','더스티 블루',80]],
  [['2011','Water Dream','워터 드림',100],['975','Misty Blue','미스티 블루',60],['939','Bering Sea','베링씨',80],['2021','Teal Blue','틸 블루',100]],
  [['2001','Navy','네이비',100]],
]},
'12_Lavender': { ko:'라벤더', en:'Lavender Scent', rowY:[0.857], rows:[
  [['959','Lilac','라일락',60],['935','Lavender','라벤더',80],['2023','Cool Lavender','쿨 라벤더',100]],
]},
'13_Pinkshade': { ko:'핑크', en:'Pink Skin shades', rowY:[0.406,0.669,0.934], rows:[
  [['2024','Pink Halo','핑크 헤일로',100],['906','Blush Pink','블러쉬 핑크',80],['2004','Cherry Blossom','체리 블라섬',100],['911','Coral Blush','코랄 블러쉬',80]],
  [['907','Sepia Rose','세피아 로즈',80],['2008','Dry petal','드라이 페탈',100],['957','Skin Pink','스킨 핑크',60],['956','Mommy Pink','마미 핑크',60]],
  [['2014','Peach','피치',100],['958','Mommy Smell','마미 스멜',60]],
]},
};

const REF_W = 4961;
const COL_X0 = 177/REF_W, COL_W = 1032/REF_W, COL_GAP = 1174/REF_W;
const S = 6;

(async () => {
  const out = {};
  let total = 0, bad = [];
  for (const [g, meta] of Object.entries(CHART)) {
    const file = CDIR + g + '_NUM.jpg';
    const m = await sharp(file).metadata();
    const W = Math.round(m.width/S), H = Math.round(m.height/S);
    const { data } = await sharp(file).resize(W,H,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});

    // 라벨 밴드 = 행 위치
    const dark = new Uint8Array(W*H);
    for (let i=0;i<W*H;i++) dark[i] = Math.max(data[i*3],data[i*3+1],data[i*3+2]) < 150 ? 1 : 0;
    const rowSum = new Int32Array(H);
    for (let y=0;y<H;y++){ let s=0; for(let x=0;x<W;x++) s+=dark[y*W+x]; rowSum[y]=s; }
    let bands=[], st=-1;
    for (let y=0;y<H;y++){
      const on = rowSum[y] > W*0.004;
      if(on && st<0) st=y;
      if(!on && st>=0){ if(y-st>=3) bands.push([st,y]); st=-1; }
    }
    if(st>=0) bands.push([st,H]);
    const need = meta.rows.length;
    // 라벨 y 위치는 각 차트 이미지를 직접 보고 읽은 비율값 (2026-08-04)
    const labelRows = meta.rowY.map(r => [Math.round(r*H), Math.round(r*H)+1]);
    if (labelRows.length !== need) bad.push(`${g}: rowY ${labelRows.length} / 필요 ${need}`);

    const list = [];
    meta.rows.forEach((row, ri) => {
      const band = labelRows[ri];
      if (!band) return;
      row.forEach((chip, ci) => {
        const x0 = Math.round((COL_X0 + ci*COL_GAP)*W);
        const x1 = Math.round(x0 + COL_W*W);
        const cy1 = band[0] - Math.round(H*0.005);
        const cy0 = cy1 - Math.round((x1-x0)*0.62);
        const mx0 = x0+Math.round((x1-x0)*0.22), mx1 = x1-Math.round((x1-x0)*0.22);
        const my0 = cy0+Math.round((cy1-cy0)*0.30), my1 = cy1-Math.round((cy1-cy0)*0.24);
        let r=0,gg=0,b=0,n=0;
        for(let y=Math.max(0,my0);y<Math.min(H,my1);y++) for(let x=mx0;x<Math.min(W,x1?mx1:mx1);x++){
          const i=y*W+x; r+=data[i*3]; gg+=data[i*3+1]; b+=data[i*3+2]; n++;
        }
        if (!n) return;
        const hex = '#'+[r/n,gg/n,b/n].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
        list.push({ no: chip[0], en: chip[1], ko: chip[2], su: chip[3], hex });
        total++;
      });
    });
    out[g] = { ko: meta.ko, en: meta.en, colors: list };
    console.log(meta.ko.padEnd(10), String(list.length).padStart(3), list.map(c=>c.hex).join(' '));
  }
  fs.writeFileSync(require('path').join(__dirname,'..','swatches.json'), JSON.stringify(out,null,1));
  console.log('\n총', total, '색');
  if (bad.length) { console.log('\n⚠ 행 개수 불일치:'); bad.forEach(b=>console.log('  ', b)); }

  // 번호 중복 점검
  const seen = {};
  for (const g of Object.values(out)) for (const c of g.colors) {
    if (seen[c.no]) console.log(`⚠ 번호 중복 ${c.no}: ${seen[c.no]} / ${c.en}`);
    else seen[c.no] = c.en;
  }
})();
