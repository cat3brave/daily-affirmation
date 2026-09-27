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
