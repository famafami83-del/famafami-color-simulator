#!/usr/bin/env bash
# 배포를 지켜보다 실패하면 **알아서 다시 시도한다.**
#
#   bash src/tools/deploy-watch.sh "내 침구 만들기"
#
# 2026-08-06 에 깃허브 페이지 배포가 계속 엎어져서 만들었다. 실패는 늘 마지막
# 「Deploy to GitHub Pages」 단계였고, 원인은 두 가지였다.
#   · 커밋을 연달아 밀어 앞 배포가 「진행 중」인 채로 뒤를 막는다 → 그놈을 취소해야 한다
#   · 깃허브 쪽이 응답을 안 줘 10분 시간초과로 끊긴다        → 그냥 다시 돌리면 된다
# 둘 다 사람이 붙어 있을 필요가 없는 일이라 여기 적어뒀다.
#
# 찾을 말(첫 번째 인자)이 라이브 화면에 실제로 나타나야 성공으로 친다.
# 「배포 성공」 표시만 믿지 않는다 — 성공이라 해놓고 옛 파일을 내주는 걸 겪었다.

set -u
REPO=famafami83-del/famafami-color-simulator
SITE=https://famafami83-del.github.io/famafami-color-simulator/
NEEDLE=${1:?라이브에서 찾을 말을 인자로 주십시오}
TRIES=${2:-6}          # 다시 시도할 횟수
GAP=20                 # 확인 간격(초)
PATIENCE=36            # 한 번의 배포를 기다리는 최대 확인 횟수 (36 × 20초 = 12분)

live() { curl -s "$SITE?cb=$RANDOM" | grep -c -- "$NEEDLE"; }
run()  { gh api "repos/$REPO/actions/runs?per_page=1" \
           --jq '.workflow_runs[0] | "\(.id) \(.status)/\(.conclusion // "-")"' 2>/dev/null; }

for try in $(seq 1 "$TRIES"); do
  echo "── ${try}번째 시도"
  for i in $(seq 1 "$PATIENCE"); do
    set -- $(run); ID=${1:-?}; ST=${2:-?}
    L=$(live)
    echo "   [$i] $ST · 라이브 $L"
    [ "$L" = "1" ] && echo "✅ 배포 완료 — 라이브에 실제로 떴습니다" && exit 0
    case "$ST" in
      *failure*|*cancelled*) echo "   실패 — 다시 돌립니다"; break ;;
    esac
    sleep "$GAP"
  done

  # 막고 있는 배포가 있으면 먼저 치운다. 안 그러면 다시 돌려도 같은 데서 막힌다.
  STUCK=$(gh api "repos/$REPO/pages/builds?per_page=5" \
            --jq '[.[] | select(.status=="building")] | .[0].commit // empty' 2>/dev/null)
  if [ -n "$STUCK" ]; then
    echo "   진행 중인 배포 $STUCK 를 취소합니다"
    gh api -X POST "repos/$REPO/pages/deployments/$STUCK/cancel" >/dev/null 2>&1
    sleep 5
  fi
  [ "$ID" != "?" ] && gh run rerun "$ID" --failed >/dev/null 2>&1 && echo "   다시 돌렸습니다"
  sleep 10
done

echo "❌ ${TRIES}번 시도했는데 안 올라갔습니다 — 사람이 봐야 합니다"
exit 1
