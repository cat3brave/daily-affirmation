# Daily Affirmation / 心のお守りアプリ

自分を責めすぎてしまう人が、やさしい言葉・小さな記録・深呼吸・お花の成長を通して、心を整えるためのWebアプリです。

## 概要

このアプリは、日々のセルフケアを支えるための個人開発アプリです。

主なテーマは以下です。

- 60点でOK
- 行けたらOK
- 私は私の作業
- 気づくだけで十分
- 背負いすぎない

AIによるアファメーション生成、厳しい自己批判のやさしい翻訳、3つのよかったこと記録、お花の成長ログ、深呼吸ナビなどを組み合わせています。

## 主な機能

### アファメーション生成

Gemini APIを使って、短い肯定文を生成します。

### 優しい翻訳機

自分を責める厳しい言葉を、やさしく客観的な言葉に変換します。

### お花の成長記録

お散歩ボタンを押すことで、お花が少しずつ成長します。満開になるとSupabaseに記録されます。

### 3つのよかったこと

今日あった小さなよかったことを3つ記録できます。ログイン中のユーザーごとに保存されます。

### 深呼吸ナビ

4-4-8呼吸を3セット行うためのガイド機能です。

### ログイン機能

Supabase Authを使って、メールアドレス・パスワードログインとGoogleログインに対応しています。

## 使用技術

- Next.js
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase
- Google Gemini API

## 関連ドキュメント

このリポジトリには、アプリの保守・再現・動作確認のために、以下の補助ファイルを用意しています。

| ファイル                  | 内容                                   |
| ------------------------- | -------------------------------------- |
| `docs/supabase-schema.md` | Supabaseのテーブル構成とRLS方針の説明  |
| `docs/app-checklist.md`   | アプリの動作確認チェックリスト         |
| `supabase/schema.sql`     | Supabase SQL Editorで実行するためのSQL |
| `.env.example`            | 必要な環境変数の見本                   |

### 注意

`.env.local` には本物のAPIキーやSupabaseの接続情報を入れます。

`.env.local` はGitHubに公開しません。

`.env.example` は、必要な環境変数名だけを確認するための見本ファイルです。

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/cat3brave/daily-affirmation.git
cd daily-affirmation
```

### 2. 必要なパッケージを入れる

このアプリを動かすために必要なものをインストールします。

```bash
npm install
```

---

### 3. 環境変数を設定する

プロジェクト直下に、次のファイルを作ります。

```txt
.env.local
```

`.env.example` を参考にして、`.env.local` に本物の値を入れます。

必要な項目は以下です。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

注意：

`.env.local` には本物のAPIキーを入れます。

そのため、`.env.local` はGitHubに公開しません。

---

### 4. Supabaseのテーブルを作る

SupabaseのSQL Editorを開きます。

そして、次のファイルの中身をコピーして実行します。

```txt
supabase/schema.sql
```

このSQLを実行すると、アプリで使うテーブルとRLS設定を作れます。

作られる主なテーブルは以下です。

- `todos`
- `bloom_logs`
- `three_good_things`

詳しい説明は、こちらにまとめています。

```txt
docs/supabase-schema.md
```

---

### 5. アプリを起動する

開発用サーバーを起動します。

```bash
npm run dev
```

ブラウザで以下を開きます。

```txt
http://localhost:3000
```

---

### 6. コードを確認する

コードに問題がないか確認します。

```bash
npm run lint
```

エラーが出なければOKです。

---

## 動作確認

大きな修正をしたあとや、公開前には、以下のチェックリストを使います。

```txt
docs/app-checklist.md
```

---

## 注意

このアプリを動かすには、以下の設定が必要です。

- SupabaseのURL
- Supabaseのanon key
- Gemini API key
- Supabaseのテーブル作成

設定が足りないと、ログイン・保存・AI生成が動かないことがあります。
