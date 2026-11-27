# AIアプリ改善ハーネス v1.0

作成日: 2026-11-20 / 対象: `cat3brave/daily-affirmation`

## できること

- 10項目の評価軸をAIに共有し、問題・根拠・優先順位を整理できる。
- 評価JSONに、未確認を合格扱いせず記録できる。
- 検証の成功・失敗・環境停止・未実行を同じ実行記録で区別できる。
- Enter操作とIME変換がある入力欄で、意図しない実行と入力消失を固定ケースで評価できる。
- リリース前の7つの必須ゲートを同じ形式で確認できる。
- Codexに「調査のみ」「1件だけ実装」「独立レビュー」の指示を使い分けられる。
- 実行コード、依存パッケージ、CI、既存の品質ゲートを変更しない。

## できないこと

このハーネス自体はコードを自動編集しない、画面を自動採点しない、ユーザーの満足度を測定しない、CIを起動しない、PRを作成・マージしない。実際のコード改善を行うのは、別途許可されたCodexなどのAIエージェント。評価JSONに記載された証拠が本物かどうかも、評価票だけでは判定できない。

## 対象リポジトリの現状（2026-11-20時点の読み取り確認）

- Next.js/React/TypeScript、スマホ利用を想定したPWA。
- `AGENTS.md` にローカル検証レベル0〜3、全量CI/必須 `Verify`、Git操作条件がある。
- `package.json` に `test` / `test:coverage` / `lint` / `build` / `e2e` / `e2e:prod` / `audit:prod` がある。
- 既存E2Eにアクセシビリティ、reflow、target-size、reduced-motion、認証などのテストがある。

以上はファイル構成の確認であり、各テストを実行して成功を確認したわけではない。

## 現在の導入範囲

このディレクトリには、評価方針、固定rubric、評価票、Codex向け指示文だけを置く。既存の `AGENTS.md`、`package.json`、CIワークフロー、品質ゲートは変更しない。

レポート自動生成器はまだ導入していない。評価票はJSONとして記録し、人が根拠とゲート状態を照合する。自動生成器を追加する場合は、テスト基盤の独立した変更としてAGENTS.mdの必要な検証を行う。

### 手順1：評価の下書きを作成

`assessment-template.json` を別名でコピーし、調査の根拠・評価・ゲートの状態・改善候補を記入する。

Linux/macOS:

```sh
cp docs/ai-improvement-harness/assessment-template.json docs/ai-improvement-harness/my-assessment.json
```

Windows PowerShell:

```powershell
Copy-Item docs/ai-improvement-harness/assessment-template.json docs/ai-improvement-harness/my-assessment.json
```

### 手順2：記録を照合する

- `evaluatedAt`、`baseCommit`、`headCommit` を実際の値に更新する。
- 点数を付けた項目には確認可能な根拠を記載する。
- 未確認の項目は `score: null`、`confidence: "unknown"` のままにする。
- 7ゲートの `fail` または `unknown` が一つでもあれば、完了・マージ可能とは扱わない。
- 評価対象の実装と評価基準の変更は同じPRに混ぜない。

### 手順3：検証結果を分類する

`EXECUTION_RECORD.md` の補助票を使い、コマンドの終了コードと観測結果を分けて記録する。ブラウザー不在などの環境停止をアプリの回帰と混同せず、どちらも成功扱いにはしない。監査コマンドが成功終了しても、出力に脆弱性があればseverityと修正可能版を残す。

Playwrightを使う場合は、E2Eを起動する前に同ファイルの既定ブラウザー事前確認を1回行う。失敗した同じ環境で複数テストを起動して同じエラーを増やさず、`blocked` として停止条件を判定する。事前確認の成功はE2E成功の代わりにはならない。

該当する入力操作を変更するときは `INTERACTION_CASES.md` の固定ケースを参照する。ケースの適用条件を満たさない画面へ機械的に広げず、単体テストと実端末確認の範囲を区別する。

## 評価JSONの書き方

各 `dimensions.<id>` に次を指定する。

- `score`: 0〜4、未確認は `null`。
- `confidence`: `high` / `medium` / `low` / `unknown`。未確認スコアは `unknown`。
- `evidence`: テスト結果、レポートパス、画面観察、測定日、ユーザーテストなどを文字列配列で記述。点数をつけるときは空配列不可。
- `note`: 解釈・限界・未確認点。

`gates.<id>.status` は `pass` / `fail` / `unknown` のみ。passには根拠必須。すべてpassでも到達できるのは `READY_FOR_HUMAN_REVIEW` 相当まで。**マージ可とは意味しない**。

`findings` は改善候補の配列。以下の例は**書式説明の架空の例**であり、実際のアプリの不具合ではない。

```json
{
  "id": "EXAMPLE-001",
  "title": "例：保存ボタンの完了表示が分かりにくい",
  "dimension": "operability",
  "severity": "medium",
  "impact": 2,
  "reach": 2,
  "confidence": 2,
  "effort": 1,
  "risk": 1,
  "evidence": ["例：利用者テストで記録された観察結果への参照"],
  "proposal": "例：保存完了を画面読み上げにも伝える",
  "verification": "例：保存テストとスクリーンリーダーで比較"
}
```

### 優先順位の読み方

`impact × reach × confidence ÷ (effort × (1+risk/2))` を比較の目安にできる。すべて1〜3の**主観的な相対値**であり、機械的な合否判定には使わない。重大な安全性・認可の問題は式の順位によらずブロックする。優先度が高いというだけで実装許可やマージ許可になるわけではない。

## 推奨するAI運用

1. `CODEX_PROMPTS.md` のプロンプトAで現状調査（編集・Git操作なし）。
2. 評価結果と改善候補を人が確認し、1件を選ぶ。
3. 変更範囲・受け入れ条件・Git操作の許可を明確にしてプロンプトBで実装。
4. 既存の `AGENTS.md` に従ってテストし、必要に応じ独立レビュアーへプロンプトCを渡す。
5. 最新headの `Verify`・Vercel・競合・レビューを確認し、既存ルールに従って採否を決める。

初回は **ホームの主要操作を迷わず始められるか**、または **「3つのよかったこと」の入力・保存が負担なくできるか** を対象にすると、範囲を絞って効果を確認しやすい。

## 既存運用との整合性

既存 `AGENTS.md` には、ユーザーが明示するまでcommit/push/PRを作成しない規定がある。このハーネスはその規定を変えない。

## 同梱ファイル

- `rubric.json`：10項目、重み、確認例、必須ゲート。
- `QUALITY_POLICY.md`：アプリ固有の品質原則、測定基準、停止条件。
- `assessment-template.json`：証拠を記入するJSON雛形。
- `CODEX_PROMPTS.md`：調査、実装、独立レビューの依頼文。
- `EXECUTION_RECORD.md`：事前確認、結果分類、再試行条件の記録票。
- `INTERACTION_CASES.md`：IME変換など、入力保持に関する固定評価ケース。
