# Gemini API 運用チェックリスト

Gemini APIの利用プランや制限、データ取扱いは変更される可能性があります。固定の上限値や料金ではなく、運用時点の公式情報を確認します。

## 応答時間の制限

`generateAffirmation`と`translateHarshVoice`は、Gemini呼び出し開始からレスポンス本文・テキスト取得までを共通の15秒で制限します。入力検証、`auth.getUser()`による認証確認、APIキー確認、利用枠RPC確認の順序です。認証確認やServer Actionの通信全体が15秒以内に完了する保証ではありません。

採用SDKは`@google/genai` **2.31.0**（exact固定）。2026-10-25 JSTにnpmのstable/latest、
配布パッケージの`engines`（Node >=20）、`dist/genai.d.ts`と`dist/node/index.mjs`を確認しました。
Node 24.19.0と現在のNext.js 16.4.2で単体テスト・本番buildを検証しました。保守対象の公式GA SDKへ置き換える目的で、
旧`@google/generative-ai` 0.24.1を依存から削除しました。モデル・プロンプト・画面は変更しません。

正式な`GenerateContentConfig.abortSignal`へ実際のAbortSignalを渡します。
SDKの`createAttemptSignal`はfetchへの転送を行いますが、成功時は本文消費後も転送リスナーを
解放しない実装でした。そのため旧Proxyは削除し、実Signalの購読を追跡してfinallyで解除します。
中断を無視する通信にも同じ後始末を行います。SDK内蔵の試行ごとのtimeoutは使わず、
生成開始・本文取得・テキスト抽出を共通タイマーとPromise.raceで制限します。
遅い成功・失敗は採用せず、遅いrejectもraceが捕捉します。
中断要求はサービス側の処理・課金を取り消す保証ではありません。

`HttpRetryOptions.attempts`は初回を含む回数（未指定時5）なので、`attempts: 1`を明示します。
`automaticContinuation: false`と`automaticFunctionCalling: { disable: true }`も指定し、
429・5xx・CONTINUATION・関数呼び出し応答でも追加生成を送りません。
空・欠落・思考のみ・非テキスト・未完了の応答は成功にしません。
SDKのtext getterは混在応答で診断ログを出し得るため、候補のテキストpartsを安全に抽出しtrimします。
クライアント初期化・レスポンス処理の例外も既存フォールバックへ変換します。

### SDKの保守とモデルの利用可否

[公式libraries](https://ai.google.dev/gemini-api/docs/libraries)は旧JS SDKを保守対象外として
現行SDKへの移行を案内しています。一方、[モデル廃止予定](https://ai.google.dev/gemini-api/docs/deprecations)
では`gemini-2.5-flash`の停止日は未発表で、2.5系は過去に利用していたユーザーへアクセスを制限する旨が記載されています。
これはSDK保守とは別の制約です。モデル名は維持し、本番プロジェクトでの利用可否は未確認です。
実Geminiへの送信・実利用枠消費・本番データ操作は行いません。

確認した移行仕様は[移行ガイド](https://ai.google.dev/gemini-api/docs/migrate)、
[公式リポジトリ](https://github.com/googleapis/js-genai)、
[APIリファレンス](https://googleapis.github.io/js-genai/)です。
採用版の根拠は配布済み2.31.0の型・実装を優先し、最新版ドキュメントとの版差に注意します。

時間切れは`timed_out`として固定案内と既存フォールバックを表示し、入力を保持して再操作可能に戻します。自動再試行は行いません。Geminiの429は従来の`rate_limited`として扱います。利用者別の利用枠は共通の引数なし `reserve_ai_usage()` で確認し、上限は `usage_limited`、確認失敗は `usage_unavailable` として区別します。

実SDKとモックfetchを組み合わせたfake timerテストで、fetch・本文待機中の中断、遅延応答の破棄、タイマー・リスナーの後始末を検証します。実Supabase・実Geminiには接続しません。

## SDK移行時の検証（2026-10-25 JST）

- 関連Vitest：`npx vitest run app/actions.test.ts app/actions.gemini.test.ts app/actions.usage-context.test.ts`、108件成功。
- `timeout 300s npm ci --cache /tmp/daily-npm`：最終lockで成功。
- `timeout 300s npm run audit:prod` / `npm audit --json` / `npm audit`：全て終了0、本番・全依存0件。
- `npm ls undici --all` / `npm ls --all`：終了0、許可されたjsdom経由undici 7.30.1、peer整合。
- `timeout 300s npm run test:coverage`：53ファイル・596件成功。Statements 93.65 / Branches 88.30 / Functions 95.83 / Lines 96.77%。
- `timeout 300s npm run lint`：成功。
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/daily-affirmation-playwright timeout 300s npx playwright install chromium`：終了1、公式配布先403 Domain forbidden。
- 同じ`PLAYWRIGHT_BROWSERS_PATH`で`timeout 600s npm run e2e`：74件全てブラウザー起動前の未導入エラー、終了1。
- 同じパスで`timeout 600s npm run e2e:prod`：本番build・TypeScript・静的生成成功、4件全て同じ未導入エラー、終了1。
- 通常testはcoverageと同じ対象のため省略。単独buildは本番E2E内の成功により省略。
- `git diff --check` / `--stat` / `--name-only`、`git status -sb` / `--short`：指定8ファイルだけを確認。

ローカル両E2Eの動作は未検証です。Chromiumの環境制限についてユーザーが許可した例外に従い、
CI検証用の通常commit・push・PR作成へ進めます。テストや監査基準・workflowは変更していません。
最新headのVerify・Vercel・公式Chromiumによる両E2E・競合状態をPRで確認します。
auto-merge設定・merge・ブランチ削除は行わず、レビュー待ちで停止します。

## 利用枠との接続

2026-10-18のユーザー報告では、DBはPR #62のSQLを本番へ導入済み（適用記録：
`20261017213728_add_ai_usage_limit_from_pr62`）。生成・翻訳で20回/JST日・直近60秒3回を共用します。
この接続実装は既にmainに含まれています。過去PR時点の「未マージ」は当時の履歴です。
今回のSDK移行では、本番での有効化・本人JWT経由HTTP正常系・実Geminiとの接続確認を行っていません。

APIキーがなければRPCもGeminiも呼ばず既存フォールバックを返します。キーがあるときは
getUserで本人確認した同じCookie対応クライアントでRPCを1回だけ実行します。
5秒のRPC期限は認証やAction全体・Geminiの15秒期限とは別です。中断要求後もDB確保の有無は断定せず、
応答不明・Gemini側429・例外・15秒期限切れでも枠の再確保や返却を行いません。
応答の実行時検証に失敗したらGeminiを呼ばず固定案内を表示します。内部情報は結果・ログへ出しません。

上限理由とDBのretry_atに基づく日本時間の再利用目安をalertで案内します。
目安時刻以降の許可は保証せず、自動再送しません。詳細は
[利用枠設計](ai-usage-limit-design.md#アプリの利用枠確認)を参照してください。

## 定期確認

- [ ] Google AI Studioで、現在有効なRPM・TPM・RPDを確認する
- [ ] 無料枠と有料枠ではデータ取扱いが異なるため、利用中のプランと適用条件を確認する
- [ ] 任意のログ共有・データ共有を、意図せず有効化していないことを確認する
- [ ] ログを利用する場合は目的を明確にし、保持期間と取得項目を必要最小限にする
- [ ] 利用量と請求残高を定期的に確認する
- [ ] `GEMINI_API_KEY`をServer Actionなどのサーバー側だけで利用し、クライアントや公開リポジトリへ公開しない

## APIキーが漏えいした場合

1. Google AI StudioまたはGoogle Cloud Consoleで、該当キーを直ちに無効化または削除する。
2. 新しいキーを発行し、利用先のサーバー環境変数を更新する。
3. デプロイし直し、旧キーが利用できないこととアプリの動作を確認する。
4. 利用状況と請求を確認し、想定外の利用があれば記録して影響範囲を調べる。
5. リポジトリ、ビルド成果物、ログなどにキーが残っていないか確認し、漏えい経路を解消する。

## Google公式ドキュメント

- [Gemini API のレート制限](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API の料金](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API 追加利用規約](https://ai.google.dev/gemini-api/terms)
- [Gemini API キーの利用方法](https://ai.google.dev/gemini-api/docs/api-key)
