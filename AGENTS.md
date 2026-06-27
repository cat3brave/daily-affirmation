# AGENTS.md

このファイルは、Daily Affirmation / 心のお守りアプリをCodexで編集するときの作業ルールです。

## 対象範囲

このルールは、このリポジトリ内のアプリ編集にだけ適用します。

## 基本方針

- 変更は小さな単位で行う
- 一度に大きく作り替えない
- 既存の世界観、UI、命名、コメントの雰囲気をできるだけ尊重する
- ユーザーが混乱しないように、作業後は変更内容を短く整理する

## Codex作業後の必須手順

コードまたは設定を修正したら、必ず以下を行う。

1. 修正後は `git status --short` を実行する。
2. `git diff --stat` を実行する。
3. `git diff --stat` は未追跡ファイルを含まないため、新規ファイルは `git status --short` で確認する。
4. 小さいコード変更では、まず変更ファイルだけ `npx eslint <changed files>` を実行してよい。
5. commit前、import/export変更、ファイル削除、設定ファイル変更では `npm.cmd run lint` を実行する。
6. `npm.cmd run lint` が120秒でタイムアウトした場合は、無限に再実行せず、変更ファイル単位の eslint 結果と timeout した事実を報告する。
7. ドキュメントのみの変更では lint を省略してよい。
8. 変更内容を短く要約する。

## 報告形式

作業後は、以下の形式で報告する。

```txt
実行したこと:
-

確認結果:
- npm run lint: 成功 / 失敗
- git status --short:
- git diff --stat:

変更要約:
-

次に確認してほしいこと:
-
```

## commit / push について

- ユーザーが明示的に依頼するまで、`git add`、`git commit`、`git push` は実行しない
- commitを依頼された場合も、先に `npm run lint` が成功していることを確認する
- `git add .` はなるべく使わず、変更対象ファイルを指定する
- `.env.local` や秘密情報を含むファイルは絶対にcommitしない

## エラー時のルール

- `npm run lint` が失敗した場合は、commitやpushをせずに停止する
- エラー内容をそのまま要約して報告する
- 原因が不明な場合は、推測で断定しない
