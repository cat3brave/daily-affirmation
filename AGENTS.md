# AGENTS.md

このファイルは、Daily Affirmation / 心のお守りアプリをCodexで編集するときの作業ルールです。

## 対象範囲

このルールは、このリポジトリ内のアプリ編集にだけ適用します。

## 基本方針

- 変更は小さな単位で行う
- 一度に大きく作り替えない
- 既存の世界観、UI、命名、コメントの雰囲気をできるだけ尊重する
- ユーザーが混乱しないように、作業後は変更内容を短く整理する
- 編集のたびに検証せず、変更をまとめてから必要な検証を行う
- 指示された対象外ファイルを変更しない
- 実データ、秘密情報、外部サービスへの不要な通信を避ける

## npmコマンドの使い分け

実行環境に合わせて、次のコマンドを使用する。

- Windows PowerShellでは `npm.cmd` と `npx.cmd` を使用する
- Linux、macOS、Codex Cloudでは `npm` と `npx` を使用する
- 報告では、実際に実行したコマンドを省略せず記載する
- 別OS向けのコマンドを機械的に実行しない

## 検証ルール

変更を完了してから、変更内容に応じて次の検証を順番に行う。

1. 作業開始時と終了時に `git status -sb` と `git status --short` を確認する。
2. コードまたはテストを変更した場合は、通常テストを1回実行する。
3. コード、テスト、設定を変更した場合は、lintを1回実行する。
4. アプリ本体、ビルド設定、依存関係を変更した場合は、buildを1回実行する。
5. E2Eテストまたは主要なユーザー操作を変更した場合は、E2Eを1回実行する。
6. 最後に `git diff --check`、`git diff --stat`、`git diff --name-only` で差分を確認する。
7. `git diff --stat` は未追跡ファイルを含まないため、新規ファイルは `git status --short` でも確認する。
8. 成功後に対象コードを変更していない検証は、同じ内容を再実行しない。
9. 原因調査が必要な場合に限り、対象ファイルや対象テストだけを個別実行してよい。
10. 実行していない検証は、理由とともに「省略」と報告する。

標準コマンドは次のとおりとする。実際には前項のOS別ルールに従う。

- 通常テスト: `npm run test`
- coverage: `npm run test:coverage`
- lint: `npm run lint`
- build: `npm run build`
- E2E: `npm run e2e`

coverage閾値に関係する変更、テスト基盤の変更、または明示的な依頼がある場合はcoverageも実行する。

## ドキュメントのみの変更

Markdownなど、実行コードや設定に影響しないドキュメントだけを変更した場合は、test、coverage、lint、build、E2Eを省略してよい。

その場合も、次の確認は必ず行う。

- `git diff --check`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`

## Codex Cloudでのタイムアウト

Codex Cloudでは、長時間かかるコマンドに原則300秒のtimeoutを付ける。

例:

```sh
timeout 300s npm run test:coverage
timeout 300s npm run build
timeout 300s npm run e2e
```

- 実行が継続中の場合は、終了するまで適切に待機する
- timeoutとテスト・lint・build自体の失敗を区別する
- 同じ失敗コマンドを、変更なしで何度も繰り返さない

## エラー時のルール

- 必須のtest、coverage、lint、build、E2Eのいずれかが失敗した場合は、その時点で停止する
- 失敗状態ではcommit、push、PR作成を行わない
- エラー内容、終了コード、タイムアウトの有無を短く正確に報告する
- 原因が不明な場合は推測で断定しない
- 変更対象外ファイルに原因がある場合は、勝手に修正範囲を広げない
- 修正を行った場合だけ、失敗した検証を再実行する
- 停止後も安全な読み取り専用確認が許可されている場合は、最終Git状態を報告する

## commit / push / PR

共通ルール:

- ユーザーが明示的に依頼するまで、`git add`、commit、push、PR作成は行わない
- `git add .`、`git add -A`、`git add --all` は使わず、対象ファイルを明示してstageする
- commit前に、必要な検証がすべて成功していることを確認する
- `.env.local`、秘密情報、生成物、対象外ファイルをcommitしない
- force push、履歴改変、既存commitの書き換えは、明示的な許可なしに行わない

Codex Cloud:

- `main`へ直接commitまたはpushしない
- 最新の`main`から作業ブランチを作成する
- 必要な検証が成功した場合だけ、対象ファイルを明示して作業ブランチへcommit・pushする
- Codex Cloud内のGitリポジトリに`origin`がない場合はterminal pushを繰り返さず、Codex CloudのGitHub連携またはPR作成機能を使用する
- `origin`の不在だけでは停止しない
- GitHub連携自体の認証または権限エラーが発生した場合だけ停止する
- `main`をbaseとする通常のPRを作成し、Draft PRは作成しない
- 同じ目的のPRがある場合は重複作成せず、既存PRを使用する
- PRのmerge方式にはSquashを使用する
- PR作成後、auto-mergeを有効にする
- 必須status checkの`Verify`を監視する
- `Verify`が成功し、競合がない場合は、GitHubのauto-mergeによるmerge完了まで待つ
- merge後、作業ブランチが自動削除されたことを確認する
- 正常系ではユーザーの承認を待たずに進める
- 次の場合だけ停止し、ユーザーへ報告する
  - test、lint、build、E2E、CIの失敗
  - merge conflict
  - push、PR作成、auto-merge設定の認証失敗
  - rulesetまたはGitHub設定によるブロック
- `main`への直接push、rulesetのbypass、force push、失敗したcheckの無視、強制mergeは禁止する
- 問題発生時も、許可された範囲を超えて修正対象を広げない

Windowsローカル:

- ユーザーが明示的に依頼した場合は、既存運用どおり`main`でcommit・pushしてよい
- push前にbranch、remote、差分、必要な検証結果を確認する
- Cloud用の作業ブランチ運用を、Windowsローカルへ機械的に適用しない

## 報告形式

作業後は、次の項目を報告する。

```txt
実行したこと:
-

使用環境とnpmコマンド:
- 環境:
- 実際に使用したnpmコマンド:

確認結果:
- test:
- coverage:
- lint:
- build:
- e2e:
- git diff --check:
- git status:

変更ファイル:
-

Commit:
- SHA:
- message:

PR:
- URL:
- CI:

次に確認してほしいこと:
-
```

- 成功、失敗、タイムアウト、省略を明確に区別する
- 省略した検証には理由を添える
- commitしていない場合はSHAを「なし」とする
- PRを作成していない場合はURLを「なし」とする
- 秘密情報や環境変数の値は報告しない
