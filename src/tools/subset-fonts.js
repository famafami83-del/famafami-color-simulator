// 페이지에 심을 폰트를 만든다 — 쓰는 글자만 잘라서.
//
// 한글 폰트는 통째로 1.3~1.6MB 다. 두 벌이면 3MB 라 페이지에 못 넣는다.
// 그런데 이 페이지가 실제로 쓰는 글자는 600자 안팎뿐이다 (한글 음절 470 남짓 + 영문·숫자
// + 기호). 그만큼만 잘라내면 두 벌 합쳐 100~200KB 로 줄어든다.
//
// 글자 목록은 **만들어진 index.html 에서 뽑는다.** 문구를 코드 여기저기서 만들기 때문에
// 소스만 봐서는 셀 수가 없다. 그래서 두 번 돌려야 한다:
//     node src/build.js          ← 글자가 다 들어간 index.html
//     node src/tools/subset-fonts.js
//     node src/build.js          ← 이번엔 폰트가 박힌다
// 폰트는 글자를 더하지 않으므로 두 번째 build 이후에도 글자 목록은 그대로다.
//
// ★ 문구를 바꾸면 반드시 다시 돌릴 것. 안 돌리면 **새로 들어간 글자만** 다른 글꼴로
//   나온다 (기기에 깔린 글꼴로 떨어진다). 티가 잘 안 나서 놓치기 쉽다.
//
// 라이선스 — Pretendard 는 OFL 이라 웹 임베딩이 된다. Paperlogy 도 웹폰트 사용을
// 허용한다 (한국제지 배포). 폰트를 바꿀 때는 **임베딩 허용인지 먼저 확인할 것.**

const subsetFont = require('subset-font');
const fs   = require('fs');
const path = require('path');
const OUT  = path.join(__dirname, '..', 'assets') + path.sep;
const ROOT = path.join(__dirname, '..', '..');
const WF   = process.env.LOCALAPPDATA + '\\Microsoft\\Windows\\Fonts\\';

// 윈도우가 「모든 사용자」로 설치하면 C:\Windows\Fonts, 「나만」이면 사용자 폴더에 넣는다.
// 둘 다 본다 — 대표는 C:\Windows\Fonts 에 넣었다고 했는데 실제로는 사용자 폴더로 갔다.
const FONTS = [
  { out:'font-head.woff2', ko:'제목 Paperlogy Bold',
    files:[WF + 'Paperlogy-7Bold.ttf', 'C:\\Windows\\Fonts\\Paperlogy-7Bold.ttf'] },
  { out:'font-body.woff2', ko:'본문 Pretendard Regular',
    files:[WF + 'Pretendard-Regular.otf', 'C:\\Windows\\Fonts\\Pretendard-Regular.otf'] },
];

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // base64 사진 덩어리는 글자가 아니다. 빼고 세지 않으면 A~Z0-9 밖에 안 남아 무의미하다.
  const text = html.replace(/data:[a-z/+-]+;base64,[A-Za-z0-9+/=]+/g, '');
  const chars = [...new Set(text)].filter(c => c >= ' ').sort().join('');
  const han = [...chars].filter(c => c >= '가' && c <= '힣').length;
  console.log(`쓰는 글자 ${chars.length}자 (한글 음절 ${han}자)`);
  if (han < 100)
    throw new Error('한글이 너무 적습니다 — index.html 을 먼저 만드셨습니까 (node src/build.js)');

  let total = 0;
  for (const f of FONTS) {
    const src = f.files.find(p => fs.existsSync(p));
    if (!src) throw new Error(`${f.ko} 폰트를 못 찾았습니다:\n  ` + f.files.join('\n  '));
    const raw = fs.readFileSync(src);
    const cut = await subsetFont(raw, chars, { targetFormat: 'woff2' });
    fs.writeFileSync(OUT + f.out, cut);
    total += cut.length;
    console.log(`${f.out.padEnd(16)} ${f.ko.padEnd(26)} `
      + `${Math.round(raw.length/1024)}KB → ${Math.round(cut.length/1024)}KB`
      + `  (${(100 - cut.length/raw.length*100).toFixed(0)}% 줄임)`);
  }
  console.log(`\n두 벌 합계 ${Math.round(total/1024)}KB `
    + `· 페이지에는 base64 라 ${Math.round(total*4/3/1024)}KB 로 들어갑니다`);
})();
