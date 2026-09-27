# Gemini API 運用チェックリスト

Gemini APIの利用プランや制限、データ取扱いは変更される可能性があります。固定の上限値や料金ではなく、運用時点の公式情報を確認します。

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
