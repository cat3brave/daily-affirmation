# Gemini API 運用チェックリスト

Gemini APIの利用プランや制限、データ取扱いは変更される可能性があります。固定の上限値や料金ではなく、運用時点の公式情報を確認します。

## 応答時間の制限

`generateAffirmation`と`translateHarshVoice`は、Gemini呼び出し開始からレスポンス本文・テキスト取得までを共通の15秒で制限します。入力検証、`auth.getUser()`による認証確認、APIキー確認、利用枠RPC確認の順序です。認証確認やServer Actionの通信全体が15秒以内に完了する保証ではありません。

導入済み`@google/generative-ai` 0.24.1の[公式SingleRequestOptions](https://github.com/google-gemini/generative-ai-js/blob/v0.24.1/types/requests.ts)がサポートするAbortSignalを使用し、期限時に中断を要求します。SDK内蔵timeoutは独自タイマーの後始末をできないため使用せず、共通ヘルパーでタイマーとSDKの中断転送リスナーを後始末します。通信が直ちに停止しない場合も時間切れを返し、遅い成功・失敗を採用しません。サービス側の処理や課金まで取り消せるとは保証しません。

時間切れは`timed_out`として固定案内と既存フォールバックを表示し、入力を保持して再操作可能に戻します。自動再試行は行いません。Geminiの429は従来の`rate_limited`として扱います。利用者別の利用枠は共通の引数なし `reserve_ai_usage()` で確認し、上限は `usage_limited`、確認失敗は `usage_unavailable` として区別します。

実SDKとモックfetchを組み合わせたfake timerテストで、fetch・本文待機中の中断、遅延応答の破棄、タイマー・リスナーの後始末を検証します。実Supabase・実Geminiには接続しません。

## 利用枠との接続

2026-10-18のユーザー報告では、DBはPR #62のSQLを本番へ導入済み（適用記録：
`20261017213728_add_ai_usage_limit_from_pr62`）。生成・翻訳で20回/JST日・直近60秒3回を共用します。
本PRではアプリ接続を実装し、実SDK＋モックfetch・UI試験で検証します。PRは未マージで止めるため、
本番での有効化・本人JWT経由HTTP正常系・実Geminiとの接続確認は未実施です。

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
