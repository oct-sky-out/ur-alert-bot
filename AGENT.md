# AGENT.md

이 문서는 이 저장소를 다루는 에이전트나 개발자가 프로젝트 구조와 유지보수 포인트를 빠르게 파악하기 위한 내부 문서다.

사용자 대상 사용 방법은 [README.md](./README.md)만 본다.

## 목적

- UR 단지 페이지 URL 목록을 감시한다.
- 금액 조건과 공실 여부를 기준으로 `ntfy` 알림을 보낸다.
- 하루 `3회` 고정 시각에 GitHub Actions로 실행한다.
- 최근 `7일` 상태 파일만 유지한다.

## 핵심 동작 요약

1. `config.json` 로드
2. 활성화된 `targets` 순회
3. 단지 페이지면 `detail_bukken_room` API 조회
4. 상세 페이지면 Playwright fallback 사용
5. 현재 회차 결과를 `CrawlResult[]`로 정규화
6. 금액 기준으로 매칭 계산
7. 직전 snapshot과 비교해 `gone` 계산
8. `ntfy` 알림 전송
9. `state/` 아래 snapshot, daily, latest 저장
10. 7일 초과 상태 파일 정리

## 파일 구조

### 루트

- [config.json](/Users/minsukim/ur-alert-bot/config.json)
  - 실제 운영 설정
- [config.local-test.json](/Users/minsukim/ur-alert-bot/config.local-test.json)
  - 로컬 점검용 샘플
- [package.json](/Users/minsukim/ur-alert-bot/package.json)
  - 런타임/스크립트 정의
- [README.md](/Users/minsukim/ur-alert-bot/README.md)
  - 사용자용 사용 방법
- [AGENT.md](/Users/minsukim/ur-alert-bot/AGENT.md)
  - 내부 구조/유지보수 문서

### GitHub Actions

- [.github/workflows/ur-alert.yml](/Users/minsukim/ur-alert-bot/.github/workflows/ur-alert.yml)
  - 스케줄 실행
  - Node 24 런타임
  - Playwright 캐시 복원
  - `NTFY_TOPIC` secret 주입
  - 실행 후 `state/` 커밋

### 소스 코드

- [src/index.ts](/Users/minsukim/ur-alert-bot/src/index.ts)
  - 전체 실행 진입점
  - config 로드, crawl, match, notify, state 저장 연결
- [src/config.ts](/Users/minsukim/ur-alert-bot/src/config.ts)
  - `zod` 기반 설정 검증
  - `NTFY_TOPIC` 환경변수 우선 적용
- [src/crawler.ts](/Users/minsukim/ur-alert-bot/src/crawler.ts)
  - 단지 페이지/상세 페이지 수집 분기
  - building page: `detail_bukken_room`
  - room detail: Playwright fallback
- [src/parser.ts](/Users/minsukim/ur-alert-bot/src/parser.ts)
  - HTML/API 응답 파싱
  - 건물 식별자, 가격, 공익비, 문의처 이름/전화번호 추출
  - parse 실패 시 `parseEvidence` 생성
- [src/matcher.ts](/Users/minsukim/ur-alert-bot/src/matcher.ts)
  - `rent_only` / `rent_plus_fee` 매칭 계산
  - gone diff 계산
- [src/notifier.ts](/Users/minsukim/ur-alert-bot/src/notifier.ts)
  - `ko` / `ja` 알림 본문 생성
  - `ntfy` 전송
  - 모바일 호환성 때문에 전화번호는 평문으로 보냄
- [src/state-store.ts](/Users/minsukim/ur-alert-bot/src/state-store.ts)
  - `latest.json`, `daily`, `snapshots` 읽기/쓰기
  - `latestSnapshotPath`를 상대경로로 정규화
- [src/retention.ts](/Users/minsukim/ur-alert-bot/src/retention.ts)
  - 7일 초과 상태 파일 삭제
- [src/time.ts](/Users/minsukim/ur-alert-bot/src/time.ts)
  - JST 기준 실행 시각 생성
- [src/diagnostics.ts](/Users/minsukim/ur-alert-bot/src/diagnostics.ts)
  - parse 실패 수, 구조 변경 의심 여부, 경고 메시지 집계

## 상태 파일 구조

```text
state/
  latest.json
  snapshots/
    2026-04-05T20-46-29+09-00.json
  daily/
    2026-04-05.json
```

### latest.json

- 마지막 실행 시각
- 최신 snapshot 상대 경로

중요:

- 절대경로를 저장하지 않는다.
- 로컬과 GitHub Actions 경로가 달라지기 때문이다.

### snapshots/*.json

각 snapshot에는 아래가 들어간다.

- `runAt`
- `priceMode`
- `maxPriceYen`
- `language`
- `matchedIds`
- `results`
- `diagnostics`

### diagnostics

구조 변경 감지용 진단 정보:

- `totalResults`
- `matchedCount`
- `parseFailureCount`
- `structureChangeSuspected`
- `warnings`
- `parseFailureIds`

구조 변경 의심 조건:

- 결과가 0건
- parse 실패 비율이 높음
- building/page 파싱 실패
- API가 비배열 등 예상 외 응답 반환

## CrawlResult 메모

`CrawlResult` 핵심 필드:

- `id`
- `targetId`
- `targetUrl`
- `url`
- `title`
- `buildingName`
- `roomId`
- `contactName`
- `contactPhone`
- `rentYen`
- `feeYen`
- `totalPriceYen`
- `isAvailable`
- `isMatched`
- `parseStatus`
- `parseMessage`
- `parseEvidence`

`id`는 보통 `targetId:roomId` 형태다.

## 운영 규칙

### 알림 규칙

- 현재 매칭 대상은 매 회차마다 알림
- gone은 하루 1회만 알림
- 언어는 `ko` 또는 `ja`
- 전화번호가 있으면 본문에 포함

### 스케줄

- `09:00 JST`
- `13:00 JST`
- `17:00 JST`

GitHub Actions에서는 UTC cron 사용.

### 보존

- 최근 7일치 상태 파일만 유지

## 유지보수 포인트

### 1. UR 구조 변경

먼저 볼 것:

- workflow 로그의 `[run:HH:MM]` diagnostics 출력
- snapshot 안의 `diagnostics.warnings`
- `results[].parseEvidence`

특히 확인할 파일:

- [src/parser.ts](/Users/minsukim/ur-alert-bot/src/parser.ts)
- [src/crawler.ts](/Users/minsukim/ur-alert-bot/src/crawler.ts)
- [src/diagnostics.ts](/Users/minsukim/ur-alert-bot/src/diagnostics.ts)

### 2. GitHub Actions 런타임

현재 기준:

- workflow runtime: `Node 24`
- 로컬 개발 최소 버전: `Node 22+`

경고가 다시 생기면 먼저 볼 것:

- `.github/workflows/ur-alert.yml`의 action major version
- `package.json`의 engines

### 3. Playwright

브라우저 캐시는 workflow에서 `~/.cache/ms-playwright`를 사용한다.

바꿀 때 주의:

- `package.json`의 Playwright 버전
- cache key
- `npx playwright install --with-deps chromium`

### 4. state 커밋

workflow는 실행 후 `state/`를 자동 커밋한다.

그래서 로컬 작업 중에는 자주 이런 상태가 생긴다.

- 로컬 `main`이 `origin/main`보다 1커밋 뒤

정리 방법:

```bash
git pull --ff-only
```

## 수정 시 기본 확인

```bash
npm run check
NTFY_DRY_RUN=1 CONFIG_PATH=config.local-test.json npm run alert:run
```

실제 workflow 확인:

1. `main`에 push
2. Actions에서 `UR Alert Bot` 수동 실행
3. 성공 여부와 `state` 커밋 확인

## 사용자 설정과 커밋 주의

- `config.local-test.json`은 로컬 테스트용이라 사용자 토픽이나 임시 URL이 들어갈 수 있다.
- 사용자가 직접 바꾼 값은 함부로 되돌리지 않는다.
- dry-run으로 생긴 `state/latest.json`, `state/snapshots/*.json`은 기능 커밋 전에 정리할지 확인하고 올린다.
