# UR Alert Bot

UR 단지 페이지 URL을 주기적으로 확인해서, 원하는 금액 조건 안의 공실이 나오면 `ntfy`로 휴대폰 알림을 보내는 프로젝트입니다.

이 문서는 사용 방법만 설명합니다.  
프로젝트 구조와 유지보수 정보는 [AGENT.md](./AGENT.md)를 참고하세요.

## 목차

1. [가장 빠른 시작](#가장-빠른-시작)
2. [GitHub Actions 설정](#github-actions-설정)
3. [알림 규칙](#알림-규칙)
4. [설정 파일](#설정-파일)
5. [로컬 점검](#로컬-점검)
6. [문제 확인 순서](#문제-확인-순서)

## 가장 빠른 시작

처음에는 아래 순서대로만 진행하면 됩니다.

1. 이 프로젝트를 `private GitHub repository`에 올립니다.
2. 휴대폰에 `ntfy`를 설치하고 토픽을 구독합니다.
3. GitHub 저장소에 `NTFY_TOPIC` secret을 등록합니다.
4. [config.json](./config.json)을 수정합니다.
5. GitHub Actions에서 `UR Alert Bot` workflow를 수동 실행합니다.
6. 휴대폰에서 알림을 확인합니다.

`ntfy` 공식 문서:

- 구독: [https://docs.ntfy.sh/subscribe/phone/](https://docs.ntfy.sh/subscribe/phone/)
- 발송 형식: [https://docs.ntfy.sh/publish/](https://docs.ntfy.sh/publish/)

## GitHub Actions 설정

### 1. 저장소 공개 범위

`private repository` 사용을 권장합니다.

### 2. ntfy 설정

휴대폰 앱 설정은 `ntfy` 공식 문서를 그대로 따르는 것이 가장 정확합니다.

- 공식 문서: [https://docs.ntfy.sh/subscribe/phone/](https://docs.ntfy.sh/subscribe/phone/)

실제로 필요한 값:

- Server: `https://ntfy.sh`
- Topic: 직접 정한 토픽 이름

토픽 이름은 추측하기 어렵게 정하는 것이 좋습니다.

예:

- `minsuk-ur-alert-2026`
- `ur-watch-8f3a-2026`

### 3. GitHub secret 등록

이 프로젝트는 `ntfy` 토픽을 저장소 파일에 넣지 않고 GitHub Actions secret으로 주입합니다.

등록 방법:

1. GitHub 저장소로 이동
2. `Settings`
3. `Secrets and variables`
4. `Actions`
5. `New repository secret`
6. 이름: `NTFY_TOPIC`
7. 값: 휴대폰에서 구독한 토픽 이름

현재 필수 secret은 `NTFY_TOPIC` 하나입니다.

### 4. config.json 수정

[config.json](./config.json)에서 아래 항목을 설정합니다.

- `language`
- `priceMode`
- `maxPriceYen`
- `targets`

예시:

```json
{
  "timezone": "Asia/Tokyo",
  "scheduleTimes": ["09:00", "13:00", "17:00"],
  "language": "ko",
  "priceMode": "rent_plus_fee",
  "maxPriceYen": 250000,
  "ntfy": {
    "serverUrl": "https://ntfy.sh",
    "topic": ""
  },
  "targets": [
    {
      "id": "tokyo-20-6870",
      "label": "プロムナード荻窪",
      "url": "https://www.ur-net.go.jp/chintai/kanto/tokyo/20_6870.html",
      "enabled": true
    }
  ]
}
```

주의:

- `ntfy.topic`은 비워둬도 됩니다.
- 실제 발송 시에는 `NTFY_TOPIC` secret 값이 우선 사용됩니다.
- `targets`는 최대 `50개`까지 권장합니다.

### 5. 수동 실행

GitHub 저장소의 `Actions` 탭에서 `UR Alert Bot` workflow를 선택하고 `Run workflow`를 실행합니다.

확인 포인트:

- workflow가 `success`로 끝나는지
- 휴대폰에 `ntfy` 알림이 오는지
- 알림 본문에 아래가 보이는지
  - 물건명
  - 월세 / 공익비 / 합계
  - 문의처 이름
  - 전화번호
  - 상세 링크

### 6. 자동 실행

기본 실행 시각은 일본 시간 기준 아래 3회입니다.

- `09:00`
- `13:00`
- `17:00`

GitHub Actions에서는 UTC cron으로 아래처럼 동작합니다.

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
    - cron: "0 4 * * *"
    - cron: "0 8 * * *"
```

## 알림 규칙

- 감시 대상은 `단지 페이지 URL` 기준입니다.
- 한 단지에서 여러 공실이 있으면 각각 개별 결과로 판단합니다.
- `priceMode = rent_only` 이면 `월세`만 비교합니다.
- `priceMode = rent_plus_fee` 이면 `월세 + 공익비`를 비교합니다.
- 현재 공실이 있고 계산된 금액이 `maxPriceYen` 이하이면 알림 대상입니다.

사라짐 규칙:

- 직전 실행에는 조건 만족이었는데 이번 실행에는 조건 미충족이면 `사라짐 알림`
- 같은 날 이미 사라짐 알림을 보낸 물건은 재알림하지 않음

예시:

- `09:00`: A, B 매칭 -> A/B 알림
- `13:00`: A만 매칭 -> A 알림 + B 사라짐 알림
- `17:00`: A만 매칭 -> A 알림만 발송

지원 언어:

- `ko`
- `ja`

전화번호:

- 단지 또는 상세 페이지에 대표 문의 전화번호가 있으면 본문에 포함합니다.
- 모바일 `ntfy` 표시 호환성을 위해 전화번호는 평문으로 보냅니다.

## 설정 파일

주요 설정:

- `language`
  - `ko` 또는 `ja`
- `priceMode`
  - `rent_only`
  - `rent_plus_fee`
- `maxPriceYen`
  - 최대 허용 금액
- `targets`
  - 감시 대상 단지 URL 목록

`targets` 규칙:

- 최대 `50개`
- `id`는 중복되면 안 됨
- `enabled: false`면 감시하지 않음
- URL은 UR 단지 페이지 URL 권장

예:

```json
{
  "id": "tokyo-20-7130",
  "label": "シャレール荻窪",
  "url": "https://www.ur-net.go.jp/chintai/kanto/tokyo/20_7130.html",
  "enabled": true
}
```

## 로컬 점검

평소 운영은 GitHub Actions 기준이지만, 필요하면 로컬에서 한 번 점검할 수 있습니다.

설치:

```bash
npm install
npx playwright install chromium
```

dry-run:

```bash
NTFY_DRY_RUN=1 CONFIG_PATH=config.local-test.json npm run alert:run
```

실제 로컬 발송:

```bash
NTFY_TOPIC=your-topic-name CONFIG_PATH=config.local-test.json npm run alert:run
```

샘플 설정 파일:

- [config.local-test.json](./config.local-test.json)

## 문제 확인 순서

1. `config.json`의 URL, 금액, 언어 설정이 맞는지 확인
2. GitHub secret `NTFY_TOPIC`이 등록되어 있는지 확인
3. Actions run이 `success`인지 확인
4. 휴대폰 `ntfy` 앱에서 같은 토픽을 구독 중인지 확인
5. 내부 구조나 유지보수 정보가 필요하면 [AGENT.md](./AGENT.md)를 확인
