# UR Alert Bot

UR 주택 단지 페이지 URL 목록을 주기적으로 확인하고, 사용자가 지정한 금액 기준 안에 있으면서 공실이 존재하는 물건을 `ntfy` 푸시로 알리는 프로젝트 설계 문서다.

## 목차

1. [설치 및 설정](#설치-및-설정)
2. [로컬 테스트 실행](#로컬-테스트-실행)
3. [목표](#목표)
4. [설정 파일](#설정-파일)
5. [내부 데이터 모델](#내부-데이터-모델)
6. [상태 저장과 보존 기간](#상태-저장과-보존-기간)
7. [GitHub Actions 운영 규칙](#github-actions-운영-규칙)
8. [권장 프로젝트 구조](#권장-프로젝트-구조)
9. [구현 원칙](#구현-원칙)
10. [알림 언어 규칙](#알림-언어-규칙)
11. [에이전트용 Skills](#에이전트용-skills)

## 설치 및 설정

### 1. 로컬 설치

권장 로컬 Node.js 버전은 `22+`이고, GitHub Actions CI는 `Node.js 24` 기준으로 실행한다.

```bash
cd /Users/minsukim/ur-alert-bot
npm install
npx playwright install chromium
```

### 2. ntfy 앱 설정

1. iPhone 또는 Android에 `ntfy` 앱을 설치한다.
2. 원하는 토픽 이름을 정한다.
3. 앱에서 아래 값으로 구독한다.
   - Server: `https://ntfy.sh`
   - Topic: 예시 `minsuk-ur-alert-2026`

### 3. GitHub 저장소 보안 설정

보안 기준으로 `ntfy` 토픽은 저장소 파일에 두지 않고 런타임 환경변수 `NTFY_TOPIC`으로 주입한다.

권장 저장 방식:

1. GitHub 저장소로 이동
2. `Settings`
3. `Secrets and variables`
4. `Actions`
5. `New repository secret`
6. 이름을 `NTFY_TOPIC`으로 설정
7. 값에 실제 토픽 이름 입력

현재 workflow는 `NTFY_TOPIC`을 GitHub Actions runtime env로 읽는다. 보안상 `Repository variable`보다 `Repository secret`을 권장한다.

### 4. 설정 파일 준비

[config.json](/Users/minsukim/ur-alert-bot/config.json) 또는 [config.local-test.json](/Users/minsukim/ur-alert-bot/config.local-test.json) 에서 아래를 조정한다.

- `language`
- `priceMode`
- `maxPriceYen`
- `targets`

`ntfy.topic`은 기본적으로 빈 문자열로 두고, 실제 발송 시에는 `NTFY_TOPIC` 환경변수로 주입한다.

## 로컬 테스트 실행

샘플 단지 URL 두 개로 로컬 검증하려면 아래처럼 실행한다.

```bash
cd /Users/minsukim/ur-alert-bot
NTFY_DRY_RUN=1 CONFIG_PATH=config.local-test.json npm run alert:run
```

- `CONFIG_PATH=config.local-test.json`
  - 샘플 테스트 설정 사용
- `NTFY_DRY_RUN=1`
  - 실제 `ntfy` 전송 없이 콘솔에 알림 메시지만 출력

실제 `ntfy`까지 보내려면:

```bash
cd /Users/minsukim/ur-alert-bot
NTFY_TOPIC=minsuk-ur-alert-2026 CONFIG_PATH=config.local-test.json npm run alert:run
```

## 목표

- 감시 대상은 UR 단지 페이지 URL 최대 `50개`다.
- 사용자는 `config.json`만 수정해서 감시 조건을 바꾼다.
- 알림 언어는 `한국어` 또는 `일본어`만 지원한다.
- 가격 비교는 `priceMode`에 따라 결정한다.
  - `rent_only`: 월세만 비교
  - `rent_plus_fee`: 월세 + 공익비 비교
- 비교 기준은 항상 `maxPriceYen` 이하 여부다.
- 알림 스케줄은 일본 시간(`Asia/Tokyo`) 기준 하루 `3회`다.
  - `09:00`
  - `13:00`
  - `17:00`
- 각 실행 시점에는 현재 조건을 만족하는 물건을 모두 알린다.
- 직전 실행에는 있었지만 이번 실행에는 없는 물건은 `사라짐 알림`을 보낸다.
- 같은 날 이미 `사라짐 알림`을 보낸 물건은 그날 다시 사라짐 알림을 보내지 않는다.
- 알림 본문은 `ntfy` Markdown 형식으로 전송한다.
- 대표 문의 전화번호가 있으면 알림에 함께 포함한다.

## 예시 동작

- `09:00`: A, B 매칭 -> `A/B 알림`
- `13:00`: A만 매칭 -> `A 알림 + B 사라짐 알림`
- `17:00`: A만 매칭 -> `A 알림만 발송`

사라짐은 아래 중 하나라도 충족하면 발생한 것으로 본다.

- 공실이 없어짐
- 가격이 기준 초과로 바뀜
- 페이지 구조 변경 또는 파싱 실패로 현재 매칭 판정을 내릴 수 없음

파싱 실패는 내부 로그에는 별도 원인으로 남기되, 비교 결과상 이번 실행의 매칭 대상이 아니면 사라짐 후보에 포함한다.

## 추천 기술 스택

- `Node.js + TypeScript`
- `Playwright`
- `Zod`
- `JSON` 상태 저장
- `ntfy`
- `GitHub Actions`

## 설정 파일

초기 버전은 루트의 `config.json` 하나를 기준으로 한다.

```json
{
  "timezone": "Asia/Tokyo",
  "scheduleTimes": ["09:00", "13:00", "17:00"],
  "language": "ko",
  "priceMode": "rent_only",
  "maxPriceYen": 80000,
  "ntfy": {
    "serverUrl": "https://ntfy.sh",
    "topic": ""
  },
  "targets": [
    {
      "id": "ur-001",
      "label": "후보 A",
      "url": "https://www.ur-net.go.jp/chintai/kanto/tokyo/20_6870.html",
      "enabled": true
    }
  ]
}
```

로컬 검증용 예시는 [config.local-test.json](/Users/minsukim/ur-alert-bot/config.local-test.json) 에 추가했다.

### 설정 규칙

- `targets`는 최대 `50개`까지만 허용한다.
- `id`는 상태 비교의 기준 키로 사용한다.
- `enabled: false`인 대상은 수집하지 않는다.
- `language`는 `ko` 또는 `ja`만 허용한다.
- 실제 알림 발송 시 `NTFY_TOPIC` 환경변수가 `ntfy.topic`보다 우선한다.
- 금액은 모두 `엔 단위 정수`로 정규화한다.
- `scheduleTimes`는 현재 요구사항상 `09:00`, `13:00`, `17:00`으로 고정한다.

## 내부 데이터 모델

각 URL 수집 결과는 최소 아래 필드를 가진다. 단지 페이지 기준이므로 한 target에서 여러 공실 결과가 생성될 수 있다.

```json
{
  "id": "ur-001:000030806",
  "targetId": "ur-001",
  "targetUrl": "https://www.ur-net.go.jp/chintai/kanto/tokyo/20_6870.html",
  "url": "https://www.ur-net.go.jp/chintai/kanto/tokyo/20_6870_room.html?JKSS=000030806",
  "title": "プロムナード荻窪 3号棟806号室",
  "contactName": "UR賃貸ショップ千歳烏山",
  "contactPhone": "03-6279-6672",
  "rentYen": 229200,
  "feeYen": 10500,
  "totalPriceYen": 239700,
  "isAvailable": true,
  "isMatched": true,
  "checkedAt": "2026-04-05T13:00:00+09:00"
}
```

`isMatched` 판정 규칙:

- `isAvailable === true`
- `priceMode === rent_only` 이면 `rentYen <= maxPriceYen`
- `priceMode === rent_plus_fee` 이면 `totalPriceYen <= maxPriceYen`

## 상태 저장과 보존 기간

상태는 저장소 안의 JSON 파일로 관리한다.

```text
state/
  latest.json
  snapshots/
    2026-04-05T09-00-00+09-00.json
    2026-04-05T13-00-00+09-00.json
  daily/
    2026-04-05.json
```

### 파일 역할

- `state/snapshots/*.json`
  - 매 실행 시점의 전체 수집 결과와 `matchedIds`
  - `diagnostics`
    - parse 실패 개수
    - 구조 변경 의심 여부
    - 경고 메시지 목록
- `state/daily/YYYY-MM-DD.json`
  - 그날 이미 `사라짐 알림`을 보낸 `goneReportedIds`
- `state/latest.json`
  - 직전 실행의 상대 snapshot 경로와 마지막 실행 시각

### 보존 규칙

- 상태 파일은 최근 `7일치`만 유지한다.
- 삭제는 알림 실행과 새 snapshot 저장이 끝난 뒤 수행한다.
- 삭제와 알림 실행은 병렬로 처리하지 않는다.
- 하나의 workflow/job 안에서 아래 순서로 처리한다.
  1. 기존 상태 읽기
  2. UR 페이지 수집
  3. 매칭 계산
  4. 알림 전송
  5. snapshot/daily/latest 저장
  6. 7일 초과 JSON 삭제
  7. 변경 사항 commit/push

## GitHub Actions 운영 규칙

GitHub Actions가 스케줄러 역할을 맡고, 애플리케이션 내부 cron은 두지 않는다.

### 스케줄

일본 시간 기준 목표 시각은 아래와 같다.

- `09:00 JST`
- `13:00 JST`
- `17:00 JST`

GitHub Actions의 `schedule`은 UTC cron을 사용하므로 기본 매핑은 아래와 같다.

- `09:00 JST` -> `00:00 UTC`
- `13:00 JST` -> `04:00 UTC`
- `17:00 JST` -> `08:00 UTC`

예시:

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
    - cron: "0 4 * * *"
    - cron: "0 8 * * *"
```

주의:

- GitHub Actions의 scheduled workflow는 혼잡 시 몇 분 지연될 수 있다.
- workflow는 반드시 직렬 처리한다.
- 같은 저장소에서 겹치는 실행을 막기 위해 `concurrency`를 설정한다.
- 상태 파일을 갱신한 뒤에는 workflow가 직접 commit/push 한다.
- workflow는 `Node.js 24`와 최신 major GitHub Action(`checkout/setup-node/cache`) 기준으로 유지한다.
- parse 실패가 많거나 결과가 0건이면 workflow 로그에 구조 변경 의심 경고를 남긴다.

## 권장 프로젝트 구조

```text
.
├── README.md
├── config.json
├── package.json
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── crawler.ts
│   ├── parser.ts
│   ├── matcher.ts
│   ├── state-store.ts
│   ├── notifier.ts
│   └── retention.ts
├── state/
│   ├── latest.json
│   ├── snapshots/
│   └── daily/
└── .github/
    └── workflows/
        └── ur-alert.yml
```

## 구현 원칙

- 처음부터 DB를 도입하지 않는다.
- UR 단지 페이지에서는 내부 `detail_bukken_room` API를 기준으로 공실 목록을 읽는다.
- `detail_bukken_room` 응답이 `null`이면 해당 단지는 현재 공실 없음으로 본다.
- 방 상세 URL이 직접 들어온 경우에만 `Playwright` fallback을 사용한다.
- 금액 문자열은 숫자 비교 전에 반드시 정규화한다.
- `disabled` target은 비교 대상에서 제외한다.
- 알림 메시지는 `config.language`에 따라 `ko` 또는 `ja`로만 생성한다.
- 알림 메시지는 `ntfy` Markdown 렌더링을 전제로 구성한다.
- 알림 메시지에는 최소 아래 정보를 포함한다.
  - 물건명
  - 월세
  - 공익비
  - 합계
  - 대표 문의 전화번호
  - URL
- 사라짐 알림에는 최소 아래 정보를 포함한다.
  - 물건명
  - 대표 문의 전화번호
  - URL
  - `이번 회차 기준 조건 미충족`

## 알림 언어 규칙

- `language: "ko"` 이면 알림 제목과 본문을 한국어로 생성한다.
- `language: "ja"` 이면 알림 제목과 본문을 일본어로 생성한다.
- 지원 언어 외 값은 설정 검증 단계에서 실패 처리한다.
- 현재 매칭 알림과 사라짐 알림 모두 같은 언어 설정을 따른다.
- 전화번호가 확인되면 같은 언어 문구 안에 함께 표시한다.

## 에이전트용 Skills

프로젝트 로컬 skill은 `.codex/skills/` 아래에 둔다.

- `ur-alert-implementer`
  - 크롤러, 파서, 매처, 상태 저장, ntfy 메시지 구현 작업용
- `ur-alert-actions-operator`
  - GitHub Actions, retention, commit/push 운영 작업용
- `ur-alert-reviewer`
  - 요구사항 회귀 검증과 테스트 설계용

이 README는 현재 프로젝트의 요구사항 기준 문서다. 구현 시 동작 규칙을 바꾸면 README도 함께 갱신한다.
