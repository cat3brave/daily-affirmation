# Deployment Checklist / 本番環境確認メモ

このファイルは、Vercel本番環境で確認した内容を記録するメモです。

---

## Vercel 環境変数

Vercelの Environment Variables に以下を設定します。

| 変数名                          | 用途              | 設定                               |
| ------------------------------- | ----------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase接続URL   | All Environments                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | All Environments                   |
| `GEMINI_API_KEY`                | Gemini APIキー    | Production and Preview / Sensitive |

---

## 確認済みのこと

- [x] Vercelに `NEXT_PUBLIC_SUPABASE_URL` が設定されている
- [x] Vercelに `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されている
- [x] Vercelに `GEMINI_API_KEY` が設定されている
- [x] `GEMINI_API_KEY` を Sensitive に設定した
- [x] 本番URLでログインできる
- [x] 本番URLで dashboard が表示される
- [x] 本番URLでアファメーション生成が動く

---

## セキュリティヘッダー

本番レスポンスで以下を確認します。

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `Content-Security-Policy: base-uri 'self'; frame-ancestors 'none'; object-src 'none';`
- [ ] `x-powered-by` が存在しない

HSTS（`Strict-Transport-Security`）はVercelが管理するため、アプリでは重複設定しません。

本番での確認例:

```sh
curl -I https://daily-affirmation-lac.vercel.app/login
```

---

## 注意

`GEMINI_API_KEY` は秘密情報です。

GitHubには保存しません。

Vercelでは Sensitive として保存します。

---

## 確認日

- 2026-05-15

## ローカルの本番ビルド用E2E

`npm run e2e` は開発サーバー用の既存E2Eを実行します。
`npm run e2e:prod` は別の `e2e-prod` / `playwright.prod.config.ts` にある
本番スモークと記録入口の検証を実行します。Windows PowerShellでは `npm.cmd run e2e:prod` を使用します。

本番用ランナーはアプリのソースとインストール済み依存を新規一時ディレクトリへコピーし、
`next build` を1回だけ実行して、その生成物を `next start` で起動します。
`.env*`、既存 `.next`、実サービスの環境変数、`NODE_OPTIONS` は引き継ぎません。
buildと起動に同じローカルSupabase URL・偽anon keyを明示し、Geminiキーは空、
アカウント削除は無効にします。通常の `npm run build` / `npm run start` は変更しません。

ポート3200（アプリ）と54321（モック）が使用中なら失敗します。
build失敗時は起動・テストへ進みません。成功・失敗・SIGINT/SIGTERMで子プロセスと
一時ディレクトリを片付けます（Windowsは `taskkill /T`、Unixはプロセスグループ）。
通常E2Eと本番用E2Eはポート54321を共有するため、順番に実行してください。

確認内容は未認証HTTPリダイレクト、公開画面とセキュリティヘッダー、モックログイン、
タブと再読み込み、3項目の未保存入力復元、AIのフォールバックと再操作、
本人の4種類のJSON書き出し、ログアウト後の保護です。
Server Actionのレスポンスを差し替えず、ビルド済み処理を通します。
書き出し時刻は操作前後の実時刻の範囲、ファイル名はブラウザーのローカル日付で検証します。
本番では無効な `E2E_EXPORT_FIXED_TIME` に依存しません。

外部通信はブラウザーのHTTPリクエストをローカル2オリジンに制限し、
それ以外への試行があればテストを失敗させます。SupabaseのローカルHTTPモックは外部転送をせず、
未知のパス・操作・テーブル・列・フィルターは失敗応答と記録で検出します。
通信記録は認証ヘッダーや本文を保存せず、Originの有無を使ってブラウザーとサーバーを区別し、
Server Action実行後のサーバー認証と4テーブルの本人フィルター付きGETを確認します。
これは実SupabaseのRLS検証ではありません。またOriginによる分類とモック記録は、
サーバーが別ホストへ行う全通信を監視するものではありません。
サーバー側は接続先の明示・秘密情報を引き継がない環境・APIキーなしの既存分岐・
モック到達記録を組み合わせて確認します。ネットワーク全体の隔離を保証するテストではありません。
ビルド時のNext.jsフォント取得は外部通信で、実Vercel/Supabase/Geminiへの接続とは別です。

CIのVerifyは本番依存監査、coverage、lint、既存E2Eの後に本番用E2Eを実行し、
従来の独立build工程はこの1回のbuildへ統合しています。どちらの失敗もVerifyを失敗させます。
ジョブ上限は既存の20分を維持します。追加は本番スモークテストとコピー・起動の時間で、
buildは増えません。PRの実測時間も確認してください。

## GitHub ActionsでのE2E確認

CIのVerifyは通常E2Eと、1回の本番buildを含む本番E2Eを順番に実行します。
Summaryの対象commit（PRではmerge commitとheadの双方）と各工程の結果を確認し、
通常用 `e2e-normal-<run id>-<attempt>`、本番用 `e2e-production-<run id>-<attempt>` の
artifactリンクを開きます。保持期間は7日です。

各ZIPは `playwright-report/normal` または `playwright-report/production` のHTMLレポートと、
対応する `test-results` 配下の診断資料を含みます。展開後、HTMLレポートは
`npx playwright show-report <展開先>/playwright-report/production` などで開けます。
画像はHTMLレポートのテスト添付、または `test-results/production` 内のPNGから確認できます。
通常・本番の出力先は互いに独立し、後続のPlaywright実行で上書きしません。

本番用の既存記録入口テストは320pxと1280px（高さ720px）、通常の動きと動きを減らす設定で、
ホーム入口のフォーカス時、移動後の記録カードと下部ナビを含むviewport、カード全体を保存します。
既存の合成データ・ローカルモックと検証ヘルパーを使い、入口操作・フォーカス・1項目保存などの
既存のassertionを維持します。画像差分テストや未確認の基準画像は追加しません。

保存stepは `always()` で、テストが失敗しても生成済み資料をアップロードします。
traceは `retain-on-failure`、失敗画像は `only-on-failure` です。buildや起動の段階で失敗すると
レポートが生成されない場合があります。テストの終了コードは直接stepの失敗に反映し、
後続の保存やSummaryが成功してもVerifyの失敗を打ち消しません。20分上限は維持します。
失敗時の保存条件はworkflow・設定を確認し、確認のための失敗commitは作りません。

画像はレビュー資料であり、存在だけで「目視レビュー済み」「美しい」とは判断しません。
これらのCIはローカルでビルドしたアプリとモックの検証です。実Vercel本番環境、
実Google認証、実DB・RLS、実機のソフトウェアキーボードの確認を代替しません。
