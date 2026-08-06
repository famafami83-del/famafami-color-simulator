#!/usr/bin/env bash
# 깃허브가 살아나기를 기다렸다가 배포하고, 라이브에 뜨는 것까지 확인한다.
#
#   bash src/tools/deploy-wait.sh "내 침구 만들기"
#
# 2026-08-06 15:22 UTC 부터 깃허브 Actions·Pages 가 대규모 장애였다. 그동안은
# 무엇을 밀어도 배포가 `queued` 에서 굳거나 아예 생기지도 않았다. 이럴 때 계속
# 다시 미는 것은 **줄만 늘리는 짓**이라, 먼저 깃허브가 살아났는지 보고 움직인다.
#
# 장애 여부는 깃허브 공식 상태판에서 읽는다. 우리 저장소만 볼 때와 달리
# 「내 문제인가 깃허브 문제인가」가 한눈에 갈린다.

set -u
REPO=famafami83-del/famafami-color-simulator
SITE=https://famafami83-del.github.io/famafami-color-simulator/
NEEDLE=${1:?라이브에서 찾을 말을 인자로 주십시오}
GAP=${2:-60}          # 확인 간격(초). 장애 기다리는 중이라 자주 볼 필요 없다

live()   { curl -s "$SITE?cb=$RANDOM" | grep -c -- "$NEEDLE"; }
# Actions 와 Pages 가 둘 다 정상이면 ok 를 찍는다
health() {
  curl -s https://www.githubstatus.com/api/v2/summary.json 2>/dev/null | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      try{ const c=JSON.parse(s).components.filter(x=>/^(Actions|Pages)$/.test(x.name));
        console.log(c.length===2 && c.every(x=>x.status==='operational') ? 'ok'
                    : c.map(x=>x.name+'='+x.status).join(' '));
      }catch(e){ console.log('상태판 못읽음'); }});" 2>/dev/null
}

echo "깃허브가 살아나기를 기다립니다 (${GAP}초마다 확인)"
fired=0
while :; do
  L=$(live)
  [ "$L" = "1" ] && echo "✅ 배포 완료 — 라이브에 실제로 떴습니다" && exit 0

  H=$(health)
  echo "$(date -u +%H:%M)Z  깃허브: $H  ·  라이브: $L"

  if [ "$H" = ok ]; then
    if [ "$fired" = 0 ]; then
      echo "   깃허브가 살아났습니다 — 배포를 겁니다"
      # 굳어 있던 것들을 먼저 치운다
      for id in $(gh api "repos/$REPO/actions/runs?per_page=20" \
                    --jq '.workflow_runs[] | select(.status!="completed") | .id' 2>/dev/null); do
        gh run cancel "$id" >/dev/null 2>&1
      done
      gh workflow run deploy.yml --repo "$REPO" >/dev/null 2>&1 \
        && echo "   Deploy 워크플로를 돌렸습니다" && fired=1
    else
      # 걸어놨는데 30분 넘게 안 뜨면 한 번 더 건다
      fired=$((fired+1))
      [ "$fired" -gt $((1800/GAP)) ] && fired=0
    fi
  fi
  sleep "$GAP"
done
