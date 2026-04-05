# UR Alert Bot

言語:
[한국어](./README.md) | [日本語](./README.ja.md)

UR団地ページのURLを定期的に確認し、希望する金額条件内の空室が見つかった場合に `ntfy` でスマートフォンへ通知を送るプロジェクトです。

この文書は使い方のみを説明します。  
プロジェクト構造や保守情報は [AGENT.md](./AGENT.md) を参照してください。

## 目次

1. [最短スタート](#最短スタート)
2. [GitHub Actions 設定](#github-actions-設定)
3. [通知ルール](#通知ルール)
4. [設定ファイル](#設定ファイル)
5. [ローカル確認](#ローカル確認)
6. [問題確認の順番](#問題確認の順番)

## 最短スタート

最初は次の順番で進めれば十分です。

1. このプロジェクトを `private GitHub repository` にアップロードします。
2. スマートフォンに `ntfy` をインストールし、トピックを購読します。
3. GitHub リポジトリに `NTFY_TOPIC` secret を登録します。
4. [config.json](./config.json) を修正します。
5. GitHub Actions で `UR Alert Bot` workflow を手動実行します。
6. スマートフォンで通知を確認します。

`ntfy` 公式ドキュメント:

- 購読: [https://docs.ntfy.sh/subscribe/phone/](https://docs.ntfy.sh/subscribe/phone/)
- 送信形式: [https://docs.ntfy.sh/publish/](https://docs.ntfy.sh/publish/)

## GitHub Actions 設定

### 1. リポジトリ公開範囲

`private repository` の利用を推奨します。

### 2. ntfy 設定

スマートフォン側の設定は `ntfy` 公式ドキュメントに従うのが最も確実です。

- 公式ドキュメント: [https://docs.ntfy.sh/subscribe/phone/](https://docs.ntfy.sh/subscribe/phone/)

実際に必要な値:

- Server: `https://ntfy.sh`
- Topic: 自分で決めたトピック名

トピック名は推測しにくい文字列にすることを推奨します。

例:

- `minsuk-ur-alert-2026`
- `ur-watch-8f3a-2026`

### 3. GitHub secret 登録

このプロジェクトは `ntfy` のトピックをリポジトリファイルへ保存せず、GitHub Actions secret として注入します。

登録手順:

1. GitHub リポジトリへ移動
2. `Settings`
3. `Secrets and variables`
4. `Actions`
5. `New repository secret`
6. 名前: `NTFY_TOPIC`
7. 値: スマートフォンで購読したトピック名

現在必須の secret は `NTFY_TOPIC` だけです。

### 4. config.json 修正

[config.json](./config.json) で以下を設定します。

- `language`
- `priceMode`
- `maxPriceYen`
- `targets`

例:

```json
{
  "timezone": "Asia/Tokyo",
  "scheduleTimes": ["09:00", "13:00", "17:00"],
  "language": "ja",
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

注意:

- `ntfy.topic` は空でも構いません。
- 実際の送信時は `NTFY_TOPIC` secret の値が優先されます。
- `targets` は最大 `200件` まで設定できます。

### 5. 手動実行

GitHub リポジトリの `Actions` タブで `UR Alert Bot` workflow を選び、`Run workflow` を実行します。

確認ポイント:

- workflow が `success` で終了するか
- スマートフォンに `ntfy` 通知が届くか
- 通知本文に以下が含まれるか
  - 物件名
  - 家賃 / 共益費 / 合計
  - 問い合わせ先名
  - 電話番号
  - 詳細リンク

### 6. 自動実行

デフォルト実行時刻は日本時間で以下の 3 回です。

- `09:00`
- `13:00`
- `17:00`

GitHub Actions では UTC cron で次のように動作します。

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
    - cron: "0 4 * * *"
    - cron: "0 8 * * *"
```

## 通知ルール

- 監視対象は `団地ページURL` 基準です。
- 1つの団地に複数の空室があれば、それぞれ個別結果として判定します。
- `priceMode = rent_only` の場合は `家賃` のみ比較します。
- `priceMode = rent_plus_fee` の場合は `家賃 + 共益費` を比較します。
- 現在空室があり、計算結果が `maxPriceYen` 以下なら通知対象です。
- 取得は一度に全件処理せず、`50件ずつ` のチャンクで処理します。
- チャンクの間には `30秒` 待機します。

消滅ルール:

- 前回実行では条件一致、今回実行では条件未達なら `消滅通知`
- 同じ日にすでに消滅通知を送った物件は再通知しません

例:

- `09:00`: A, B 一致 -> A/B 通知
- `13:00`: A のみ一致 -> A 通知 + B 消滅通知
- `17:00`: A のみ一致 -> A 通知のみ送信

対応言語:

- `ko`
- `ja`

電話番号:

- 団地ページまたは詳細ページに代表問い合わせ電話番号があれば本文に含めます。
- モバイル `ntfy` 表示互換性のため、電話番号は Markdown リンクではなく平文で送ります。

## 設定ファイル

主な設定:

- `language`
  - `ko` または `ja`
- `priceMode`
  - `rent_only`
  - `rent_plus_fee`
- `maxPriceYen`
  - 上限金額
- `targets`
  - 監視対象の団地 URL 一覧

`targets` のルール:

- 最大 `200件`
- `id` は重複不可
- `enabled: false` の場合は監視しない
- URL は UR の団地ページ URL を推奨

例:

```json
{
  "id": "tokyo-20-7130",
  "label": "シャレール荻窪",
  "url": "https://www.ur-net.go.jp/chintai/kanto/tokyo/20_7130.html",
  "enabled": true
}
```

## ローカル確認

通常運用は GitHub Actions 基準ですが、必要ならローカルで 1 回確認できます。

インストール:

```bash
npm install
npx playwright install chromium
```

dry-run:

```bash
NTFY_DRY_RUN=1 CONFIG_PATH=config.local-test.json npm run alert:run
```

実際のローカル送信:

```bash
NTFY_TOPIC=your-topic-name CONFIG_PATH=config.local-test.json npm run alert:run
```

サンプル設定ファイル:

- [config.local-test.json](./config.local-test.json)

## 問題確認の順番

1. `config.json` の URL、金額、言語設定が正しいか確認
2. GitHub secret `NTFY_TOPIC` が登録されているか確認
3. Actions run が `success` か確認
4. スマートフォンの `ntfy` アプリで同じトピックを購読しているか確認
5. 内部構造や保守情報が必要なら [AGENT.md](./AGENT.md) を確認
