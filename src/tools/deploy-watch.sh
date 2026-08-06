#!/usr/bin/env bash
# 배포를 지켜보다 막히면 **알아서 뚫는다.**
#
#   bash src/tools/deploy-watch.sh "내 침구 만들기" [시도횟수]
#
# 2026-08-06~07 에 깃허브 페이지 배포가 세 가지로 엎어졌다. 셋 다 사람이 붙어 있을
# 필요가 없는 일이라 여기 적어뒀다.
#   ① 커밋을 연달아 밀어 앞 배포가 「진행 중」인 채로 뒤를 막는다 → 그놈을 취소한다
#   ② 깃허브가 응답을 안 줘 10분 시간초과로 끊긴다               → 그냥 다시 돌린다
#   ③ **queued 에서 시작조차 못 한다** (8시간을 그렇게 있었다)   → 새 커밋으로 다시 부른다
#
# ③ 이 고약하다. queued 는 실패가 아니라 「대기 중」이라, 실패만 보고 있으면 영영
# 안 깨어난다. 그래서 **queued 가 오래 가면 그것도 막힌 것으로 본다.**
#
# 찾을 말(첫 번째 인자)이 라이브 화면에 실제로 나타나야 성공으로 친다.
# 「배포 성공」 표시만 믿지 않는다 — 성공이라 해놓고 옛 파일을 내주는 걸 겪었다.

set -u
REPO=famafami83-del/famafami-color-simulator
SITE=https://famafami83-del.github.io/famafami-color-simulator/
NEEDLE=${1:?라이브에서 찾을 말을 인자로 주십시오}
TRIES=${2:-4}
GAP=20            # 확인 간격(초)
PATIENCE=33       # 한 배포를 기다리는 최대 횟수 (33 × 20초 = 11분. 깃허브 시간초과가 10분)
QUEUE_LIMIT=12    # queued 가 이만큼(4분) 이어지면 실행기가 안 붙은 것으로 본다

live() { curl -s "$SITE?cb=$RANDOM" | grep -c -- "$NEEDLE"; }
run()  { gh api "repos/$REPO/actions/runs?per_page=1" \
           --jq '.workflow_runs[0] | "\(.id) \(.status)/\(.conclusion // "-")"' 2>/dev/null; }

# 막고 있는 Pages 배포를 치운다
unblock() {
  local s
  s=$(gh api "repos/$REPO/pages/builds?per_page=5" \
        --jq '[.[] | select(.status=="building")] | .[0].commit // empty' 2>/dev/null)
  [ -n "$s" ] && echo "   진행 중인 배포 $s 취소" \
    && gh api -X POST "repos/$REPO/pages/deployments/$s/cancel" >/dev/null 2>&1 && sleep 5
}

for try in $(seq 1 "$TRIES"); do
  echo "── ${try}번째"
  stuck=''; qcount=0
  for i in $(seq 1 "$PATIENCE"); do
    set -- $(run); ID=${1:-?}; ST=${2:-?}
    L=$(live)
    echo "   [$i] $ST · 라이브 $L"
    [ "$L" = "1" ] && echo "✅ 배포 완료 — 라이브에 실제로 떴습니다" && exit 0
    case "$ST" in
      *failure*|*cancelled*) stuck=failed; break ;;
      queued*) qcount=$((qcount+1));
               [ "$qcount" -ge "$QUEUE_LIMIT" ] && stuck=queued && break ;;
      *) qcount=0 ;;
    esac
    sleep "$GAP"
  done
  [ -z "$stuck" ] && stuck=timeout

  echo "   막힘: $stuck"
  unblock
  if [ "$stuck" = failed ] && [ "$ID" != "?" ]; then
    gh run rerun "$ID" --failed >/dev/null 2>&1 && echo "   다시 돌렸습니다"
  else
    # queued 로 굳었거나 하염없이 안 끝나면 **다시 돌려도 소용없다.** 새 커밋으로 부른다.
    [ "$ID" != "?" ] && gh run cancel "$ID" >/dev/null 2>&1
    git -C "$(dirname "$0")/../.." commit --allow-empty -q \
      -m "배포를 다시 부른다 (${try}번째, ${stuck})" \
      -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" \
      && git -C "$(dirname "$0")/../.." push -q && echo "   빈 커밋으로 새 배포를 걸었습니다"
  fi
  sleep 10
done

echo "❌ ${TRIES}번 시도했는데 안 올라갔습니다 — 사람이 봐야 합니다"
exit 1
