# npm依存関係監査・引き継ぎ記録

## 最新: CI #90の本番High対応（2026-10-09 JST）

以下を現在の結果とする。後半の「履歴」は過去の記録であり、現在の監査・commit・検証状態とは区別する。本対応は部分対応であり、全依存の脆弱性を解消したものではない。

作業ブランチは `codex/address-development-dependency-vulnerabilities`。保存済みcommit `c56600de676f437f29f4f658cde63fb1ee2edf96` を保持し、その後に追加する更新。mainへの直接反映、履歴改変、旧PR #52の取込み・操作は行わない。ユーザーの指示により、ローカルE2Eが環境制限で実行できなくても、利用可能な検証と本番監査の成功後に同じ作業ブランチへcommit・通常pushし、GitHub CIでの検証用に保存する。完成・E2E検証済みとは扱わず、PR作成・CI手動実行は行わない。

### CIログと今回の監査

[CI #90](https://github.com/cat3brave/daily-affirmation/actions/runs/37840876988) は2026-10-08 20:37:52 UTC（2026-10-09 05:37:52 JST）開始、対象SHAは上記保存済みcommit。Verifyのjobログとstep結果を取得し、`npm ci` 成功後に `npm run audit:prod` が終了1、本番Highが `next`、`sharp`、`source-map-js` の3パッケージだったことを確認した。coverage、lint、Chromium導入、E2E、buildはすべてskippedで、成功とは扱わない。

CIの過去件数を流用せず、更新前と最終依存のそれぞれで `npm ci` 後にnpm監査APIのJSON応答を取得した。通信・認証エラーの応答ではなく、`metadata.vulnerabilities` と各advisoryを含む有効な応答だった。

| 監査 | 今回の更新前 | 今回の更新後 | 終了コード（前→後） |
| --- | --- | --- | --- |
| 本番依存 | High 3、他0、計3 | 全severity 0、計0 | 1 → 0 |
| 全依存 | High 8、Moderate 5、Low 1、Critical 0、計14 | High 5、Moderate 5、Low 1、Critical 0、計11 | 1 → 1 |

更新前JSONの保存時刻は2026-10-08 20:41:21–24 UTC（2026-10-09 05:41 JST）。更新後の全依存監査は20:46:44 UTC、本番JSON監査は20:46:45 UTC（いずれも2026-10-09 05:46 JST）に開始した。本番スクリプト監査も同時間帯に成功した。件数はnpm auditのパッケージ集計であり、独立advisory数ではない。今回本番Highを3件減らしたが、**全依存監査は残存Highにより終了1で、成功していない**。

### 必要最小限の更新と公式根拠

| 対象 | 更新 | 依存経路・採用理由 |
| --- | --- | --- |
| `next` | 16.3.6 → 16.3.8 | 直接本番依存。公式advisoryが示す16系の最小修正版。同じminorのpatch更新で、監査が提案した16.4.0の強制適用は行わない |
| `eslint-config-next` | 16.3.6 → 16.3.8 | Next本体と同版に整合。内包する `@next/eslint-plugin-next` も16.3.8。公式パッケージのpeerはESLint `>=9.0.0`、TypeScript `>=3.3.1` で既存設定に対応 |
| `sharp` | 0.35.4 → 0.35.5 | `next → sharp`。Nextのoptional依存範囲 `^0.35.4` 内でlock更新。対応する `@img/sharp-*` と `@img/sharp-libvips-*` も追従更新 |
| `source-map-js` | 1.2.1 → 1.2.2 | 本番経路は `next → postcss 8.5.23 → source-map-js`。各親の `^1.2.1` 内でlock更新 |

`source-map-js` は開発経路でも共有される: `@tailwindcss/postcss → @tailwindcss/node / postcss`、`@vitest/coverage-v8 → magicast`、`jsdom → @asamuzakjp/dom-selector → css-tree`。開発ツールで使われることだけを理由に、本番集計から除外していない。

Nextの `@next/env` と各プラットフォームのSWCも16.3.8へ追従。更新前後のlock比較で、変更は上記とそれらの対応パッケージに限定される。Vitestとcoverage-v8は双方4.1.10のまま維持し、React・認証・DB・アプリ機能・CI・ESLint/Playwright設定は変更しない。

[Next 16.3.8公式ESLint情報](https://github.com/vercel/next.js/blob/v16.3.8/docs/01-app/03-api-reference/05-config/03-eslint.mdx) はESLint CLIとflat configで `eslint-config-next` を使用する構成を説明する。対象版の公式npmメタデータでもpeerとpluginの正確な版指定を確認した。異なるNext/config minor間の互換保証は確認していないため、同版に揃えた。

実際の更新コマンド:

```sh
npm install --package-lock-only --save-exact next@16.3.8 eslint-config-next@16.3.8 --cache /tmp/daily-affirmation-npm-cache
npm update sharp source-map-js --package-lock-only --cache /tmp/daily-affirmation-npm-cache
```

`npm audit fix --force`、無関係な一括更新、overrides、監査・検証の無効化は使用していない。既存の `audit:prod` とワークフローは維持し、今回は `audit:all` のスクリプト・CI追加を行わない。

### 解消した本番Highの影響条件と評価限界

公式GitHub advisory本文と修正版欄を今回取得して確認した。

| パッケージ / 直接advisory | 影響条件 | このリポジトリでの確認・限界 |
| --- | --- | --- |
| `next`: [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)、影響 `>=16.0.0 <16.3.8`、修正16.3.8 | Image Optimizationで許可された攻撃者制御のremote URLを通じたSSRF（私設IP等）。`images.remotePatterns` 未設定なら非該当と公式が説明 | `next.config.ts` はHTTPSの `www.google.com` の `/favicon.ico` のみ許可している。任意ホストを許可する設定ではないがremotePatternsは存在するため、未設定向けの非該当条件は使わない。実配備先のDNS・リダイレクト等と攻撃到達性のPoCは未検証。設定緩和ではなく修正版へ更新 |
| `sharp`: [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)、影響 `<0.35.5`、修正0.35.5 | SVG処理に使用するlibrsvgのメモリ脆弱性。glibc Linuxの特定ランタイム条件下ではRCEの可能性。公式はlibrsvg 2.63.2とNode PIE条件も説明 | Next画像処理の推移依存。アプリによる直接sharp呼出や `dangerouslyAllowSVG` の有効化は確認されないが、安全性の証明ではない。ローカルの `require('sharp').versions` でsharp 0.35.5 / rsvg 2.63.2を確認。実配備先のNode PIE、OS、グローバルlibrsvg利用状態は未確認 |
| `source-map-js`: [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)、影響 `>=1.0.0 <1.2.2`、修正1.2.2 | indexed source mapのsection offset lineに巨大値を与えると同期処理でevent loopを長時間ブロックしDoS | NextのPostCSSを通じて本番依存に含まれ、ビルド・coverage等でも使用される。アプリでの直接呼出は見つからない。外部から細工したsource mapを渡す全経路や攻撃再現は未検証。開発・CIへの影響も除外しない |

Nextの本番High集計には、上記Highに加えて以下の直接advisoryも含まれていた。いずれも16.3.8で修正され、更新後JSONでは検出されない:

- Moderate [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7): Cache Components / `experimental.useCache` とDraft Modeを併用した同時cache fillによるdraft漏えい・永続化。
- Moderate [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676): self-hosted Pages RouterのSSG/ISRキャッシュ汚染。公式はVercel非該当と説明。
- Low [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv): 開発者が悪意あるWebサイトを訪問した際、`next dev` のMCP endpointから開発情報を取得できる。開発環境も評価対象。
- Moderate [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x): webpackで構築したApp Routerのmetadata image routesで `dynamicParams` を無視し、除外したdynamic segmentへアクセス可能。
- Moderate [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p): root-level catch-allとSSG/ISRを組み合わせたresponse cache汚染・cross-user置換・永続DoS。

### 残存する開発依存High

今回公式advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) の修正版欄は引き続き `None`。`braces <=3.0.3` に深いbraceパターンを渡すと再帰AST処理でスタック枯渇し、未捕捉RangeErrorでNodeプロセスが終了し得る。

```text
eslint-config-next 16.3.8
  → @next/eslint-plugin-next 16.3.8
  → fast-glob 3.3.1 → micromatch 4.0.8 → braces 3.0.3
```

High 5件のうち直接advisoryを持つのは推移依存 `braces` 1パッケージ。残る4件は `micromatch`、`fast-glob`、`@next/eslint-plugin-next`、`eslint-config-next` への伝播で、独立したHigh advisoryが5件ある意味ではない。本番監査ではこの経路は除外されるが、開発・CIでは残存する。

更新後pluginの実装と `node_modules/.bin/eslint --print-config app/page.tsx` を再確認し、`@next/next/no-html-link-for-pages` は `[2]`、`settings.next` は未設定だった。確認した経路は `settings.next.rootDir → getRootDirs → fast-glob.globSync → micromatch.braces → braces`。現在はrootDir未指定で `context.cwd` を返すため、そのglob呼出は省略される。

ESLint設定を編集できるPR投稿者や、外部globをrootDirへ組み込む開発設定は問題の入力を渡せる候補で、CI/ローカルlintの停止につながり得る。設定を変更できる主体には任意の設定コードを実行できる権限との重なりもある。公開アプリのフォーム・URL・保存データからこのglobへ渡す経路、JSXのhrefやファイル名だけでrootDirへ渡す経路は今回確認されていない。開発依存であることだけを根拠に安全とは断定しない。

未確認事項は、実際の攻撃パターンでの再現、全ファイルの有効ESLint設定、依存・外部ツールを含む全間接経路、外部PRの実行承認・GitHub権限設定。後半の到達性調査も参照。修正版公開またはNext pluginの安全なglob実装移行後に再検討する。監査が提示するNext config 14系へのダウングレードは採用しない。

Low 1 / Moderate 5もすべて開発依存側に残る。候補は `@babel/core` 7.29.0 → 7.29.6以降、`@humanfs/node` 0.16.7 → 0.16.8以降、`ajv` 6.12.6 → 6.14.0以降、`vitest` と `@vitest/coverage-v8` の4.1.11への同時更新（Vitest/mocker/coverageの伝播でModerate集計3）。今回のCI停止原因である本番Highの最小修正に範囲を限定し、これらの追加更新は行わない。各影響・候補advisoryは履歴の記録に保持する。

### 最終依存関係での検証

実行環境: Linux、Node v24.19.0、npm 11.9.0。ホームのnpmキャッシュはread-onlyのため、通信エラーと混同せず一時キャッシュを指定した。

| 実際に実行したコマンド | 結果 |
| --- | --- |
| `timeout 300s npm ci --cache /tmp/daily-affirmation-npm-cache` | 成功、終了0 |
| `NPM_CONFIG_CACHE=/tmp/daily-affirmation-npm-cache timeout 300s npm run audit:prod` | 成功、終了0、脆弱性0 |
| `timeout 300s npm audit --omit=dev --json --cache /tmp/daily-affirmation-npm-cache` | 有効なJSON、終了0、脆弱性0 |
| `timeout 300s npm audit --json --cache /tmp/daily-affirmation-npm-cache` | 有効なJSON、終了1、High 5 / Moderate 5 / Low 1。脆弱性検出であり通信エラーではない |
| `timeout 300s npm run test` | 成功、終了0、45ファイル・344件 |
| `timeout 300s npm run test:coverage` | 成功、終了0、45ファイル・344件。Statements 91.86%、Branches 86.35%、Functions 95.36%、Lines 94.46%。閾値維持 |
| `timeout 300s npm run lint` | 初回終了1（Git管理外の既存Playwright生成レポート内の255エラー・2774警告）。その生成レポートのみを `/tmp/daily-oct9-preserved-playwright-report` へ退避して保持後、同じコマンドを再実行し終了0。ソース・lint設定・ルールは変更していない |
| `timeout 300s npm run build` | 成功、終了0。Next 16.3.8でコンパイル・TypeScript・静的ページ生成完了。既存CIと同じ非秘密のダミー値を `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`GEMINI_API_KEY` にコマンド環境で指定 |
| `timeout 600s npm run e2e` | 省略。ブラウザー未導入のため動作検証未実施 |

対応Playwrightは1.62.1、Chromium / Headless Shellは151.0.7922.34、revision 1234。標準キャッシュと既知の一時キャッシュに対応ブラウザーがないことを今回確認した。管理環境revision 12のrestrictedポリシーはenforcedで、`cdn.playwright.dev` が許可一覧にない。公式URLは `https://cdn.playwright.dev/builds/cft/151.0.7922.34/linux64/chrome-linux64.zip`。同URLへの以前の403 `Domain forbidden` は通信ポリシーによる拒否であり、npm監査の脆弱性検出とは別。本対応ではダウンロードや疎通を再試行していない。非公式配布元・非対応ブラウザーで代用しない。

E2Eが実行可能になった際は既存Playwright設定のローカルSupabaseモック・Geminiモックを使用する。実サービス接続・秘密情報追加は不要。今回はユーザーが許可したGitHub CI検証用の保存であり、新commitでのChromium導入・E2E・Verifyは今後のCI実行で確認する必要がある。PR・mainへのpush・force push・旧PR #52の操作は行わない。

`git diff --check` は成功。`git diff --stat`、`git diff --name-only`、`git status -sb`、`git status --short` を確認し、変更は `package.json`、`package-lock.json`、本ドキュメントの3ファイルのみ。生成レポート・node_modules・秘密情報はstage対象に含めない。

## 履歴: 2026-10-06の初回対応・停止後調査

記録日: 2026-10-06（Asia/Tokyo）。監査件数と実行済み検証は前回作業の結果であり、今回の調査で再実行した結果ではない。依存ファイルは前回停止時の内容を保持している。

作業ブランチ: `codex/address-development-dependency-vulnerabilities`。未stage・未commit。

基準main: bd2c75830465c23f08171e97208fcc4b007f57e1。旧PR #52の操作・取込みなし。

|監査|更新前|更新後|
|---|---|---|
|全依存|{"info":0,"low":1,"moderate":5,"high":11,"critical":0,"total":17}|{"info":0,"low":1,"moderate":5,"high":5,"critical":0,"total":11}|
|本番依存|{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}|{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}|

## High / Critical

Criticalは前後とも0。件数はadvisory数ではなくnpm auditのパッケージ集計。

### brace-expansion

依存経路: ESLint → minimatch → brace-expansion / eslint-config-next → typescript-eslint → typescript-estree → minimatch → brace-expansion

影響条件: 細工されたbrace/globパターンによるCPU・メモリ消費、再帰によるスタック枯渇。lintやCIの入力・設定が信頼できない場合も影響し得る。

修正版: 1.1.21 / 2.1.7に更新。High解消。

- [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp)（影響範囲: `>=2.0.0 <2.1.2`）
- [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp)（影響範囲: `<1.1.16`）
- [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg)（影響範囲: `<1.1.17`）
- [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg)（影響範囲: `>=2.0.0 <2.1.3`）
- [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895)（影響範囲: `>=2.0.0 <2.1.4`）
- [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895)（影響範囲: `<1.1.18`）
- [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7)（影響範囲: `<1.1.20`）
- [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7)（影響範囲: `>=2.0.0 <2.1.6`）
- [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)（影響範囲: `<1.1.19`）
- [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)（影響範囲: `>=2.0.0 <2.1.5`）

### braces

依存経路: eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces

影響条件: 深くネストしたbraceパターンを再帰AST処理に渡すと未捕捉RangeErrorでNodeプロセス終了。開発・CIのlintも評価対象。通常の本番HTTPリクエストから到達する経路は今回確認していない。

修正版: 公開最新3.0.3まで影響。公式advisory Patched versions: None。安定版eslint-config-next 16.3.8もfast-glob 3.3.1を使用。

- [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)（影響範囲: `<=3.0.3`）

### browserslist

依存経路: eslint-config-next → eslint-plugin-react-hooks → @babel/core → @babel/helper-compilation-targets → browserslist

影響条件: 多数の異なるクエリ結果のキャッシュ蓄積によるOOM、および信頼できないcustom statsの処理によるcrash/prototype書込み。ビルド・lint処理で影響し得る。

修正版: 4.28.6超に修正版あり。4.29.3に更新。

- [Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx)（影響範囲: `<=4.28.6`）
- [Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)](https://github.com/advisories/GHSA-73wf-gq98-2v4g)（影響範囲: `<=4.28.6`）

### flatted

依存経路: eslint → file-entry-cache → flat-cache → flatted

影響条件: 細工されたキャッシュJSONをparseすると再帰DoSまたはprototype pollution。共有・改ざんされたlintキャッシュも入力になり得る。

修正版: 3.4.1超に修正版あり。3.4.4に更新。

- [flatted vulnerable to unbounded recursion DoS in parse() revive phase](https://github.com/advisories/GHSA-25h7-pfq9-p65f)（影響範囲: `<3.4.0`）
- [Prototype Pollution via parse() in NodeJS flatted](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh)（影響範囲: `<=3.4.1`）

### js-yaml

依存経路: eslint → @eslint/eslintrc → js-yaml

影響条件: 細工されたYAMLのmerge-keyチェーン・!!omap・空merge sourceの反復処理でCPU DoS。YAML設定処理の利用時に影響。

修正版: 4.3.2で対象High修正。4.3.2に更新。

- [js-yaml: YAML merge-key chains can force quadratic CPU consumption](https://github.com/advisories/GHSA-52cp-r559-cp3m)（影響範囲: `>=4.0.0 <4.3.0`）
- [JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)（影響範囲: `>=4.0.0 <4.3.1`）
- [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh)（影響範囲: `>=4.0.0 <4.3.2`）

### minimatch

依存経路: eslint / eslint-config-next配下ESLint plugins → minimatch、およびtypescript-eslint → typescript-estree → minimatch

影響条件: 細工されたwildcard、複数GLOBSTAR、ネストextglobにより正規表現バックトラッキングDoS。lint/CIのglob入力で影響し得る。

修正版: 3.1.4 / 9.0.7以上でHigh修正。3.1.5 / 9.0.9に更新。

- [minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern](https://github.com/advisories/GHSA-3ppc-4f35-3m26)（影響範囲: `<3.1.3`）
- [minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern](https://github.com/advisories/GHSA-3ppc-4f35-3m26)（影響範囲: `>=9.0.0 <9.0.6`）
- [minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments](https://github.com/advisories/GHSA-7r86-cg39-jmmj)（影響範囲: `<3.1.3`）
- [minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments](https://github.com/advisories/GHSA-7r86-cg39-jmmj)（影響範囲: `>=9.0.0 <9.0.7`）
- [minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions](https://github.com/advisories/GHSA-23c5-xmqv-rm74)（影響範囲: `<3.1.4`）
- [minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions](https://github.com/advisories/GHSA-23c5-xmqv-rm74)（影響範囲: `>=9.0.0 <9.0.7`）

### undici

依存経路: jsdom → undici

影響条件: 共有HTTP cacheのprivate directivesによる利用者間漏えい・crash、要求外WebSocket subprotocolによるDoS、BalancedPoolのconnect options欠落によるTLS検証bypass。該当API・設定および外部からの応答が必要。テストランナーも影響対象。

修正版: 7.29.1で対象High修正。7.30.0に更新。

- [undici vulnerable to cross-user information disclosure and parse-time crash via degenerate private cache directives](https://github.com/advisories/GHSA-4cwx-7wf7-3272)（影響範囲: `>=7.0.0 <7.29.0`）
- [undici vulnerable to Denial of Service via unrequested WebSocket subprotocol](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5)（影響範囲: `>=7.0.0 <7.29.1`）
- [undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool](https://github.com/advisories/GHSA-w293-vg96-wgc3)（影響範囲: `>=7.24.1 <7.29.1`）

High集計の eslint-config-next、@next/eslint-plugin-next、fast-glob、micromatch は自身の独立advisoryではなくbracesの伝播。対応URL・条件はbracesと同じ。

## 互換性

[Next.js公式ESLint情報](https://raw.githubusercontent.com/vercel/next.js/canary/docs/01-app/03-api-reference/05-config/03-eslint.mdx)と[公式16移行ガイド](https://raw.githubusercontent.com/vercel/next.js/canary/docs/01-app/02-guides/upgrading/version-16.mdx)を確認。Next 16の設定はESLint 9に対応し、インストール対象のeslint-config-next@16.3.6のpeerDependenciesはeslint >=9.0.0、typescript >=3.3.1。同パッケージは@next/eslint-plugin-next 16.3.6を正確に指定。Next本体16.3.6に設定を揃えた。公式の異なるminor間の互換保証は確認できていない。vitestとcoverage-v8は両方4.1.10で維持。

## 残るLow・Moderate

- @babel/core (Low): sourceMappingURLによるファイル読取り。7.29.6/7.29.7等の7系更新候補。
- @humanfs/node (Moderate): copyがsymlinkを辿る。0.16.8以上の互換範囲更新候補。
- ajv (Moderate): $data使用時のReDoS。6.14.0以上への互換範囲更新候補。
- vitest / @vitest/mocker / @vitest/coverage-v8 (Moderate、集計3): redirect mockでpath traversal/arbitrary file read。vitestとcoverage-v8を4.1.11へ同時更新する候補。coverage-v8@4.1.11のpeerはvitest 4.1.11。

Highの修正版不在で目的を完了できないため、上記の追加更新は実施していない。開発依存だから無影響とは判断していない。

## 停止と対応案

bracesの修正版公開、またはNext ESLint pluginが安全なglob実装に移行した安定版公開後、Next本体とeslint-config-nextを整合させて更新する。現在監査が提示するeslint-config-next 14.2.35へのmajorダウングレードはNext 16との整合・設定変更が必要なため採用しない。根拠のないoverrides、force fix、警告抑制なし。Highが残るためaudit:all追加とCI変更の条件は未達。commit・push・PR・auto-merge・merge・remote branch削除は未実施。

## 実行した検証

- `timeout 300s npm ci`: 成功（最終依存関係、終了0）。
- `timeout 300s npm run audit:prod`: 成功、0件（終了0）。
- `npm audit --json` / `npm audit --omit=dev --json`: 更新前後に実行、成功応答を取得。全依存監査は脆弱性が残るため終了1、本番は終了0。初回のサンドボックス通信エラーはネットワーク許可付き実行で解消し、脆弱性なしとは扱っていない。
- `timeout 300s npm run audit:all`: 省略。Highが残り、ユーザー指定のスクリプト追加条件を満たしていないため未追加。全依存の実監査は上記JSONで確認済み。
- `timeout 300s npm run test`: 成功（45ファイル、344件、終了0）。
- `timeout 300s npm run test:coverage`: 成功（45ファイル、344件、終了0）。Statements 91.86%、Branches 86.35%、Functions 95.36%、Lines 94.46%。閾値維持。
- `timeout 300s npm run lint`: 成功（終了0）。
- `timeout 300s npm run build`（既存CIと同じダミー環境値をコマンドの前に指定。秘密情報・実サービス資格情報は使用していない）: 成功（終了0、既存CIのダミー値を使用）。
- `timeout 600s npm run e2e`: 失敗（67件、終了1、タイムアウトなし）。Chromium headless shell v1234が未導入。`PLAYWRIGHT_BROWSERS_PATH=/tmp/daily-affirmation-playwright timeout 300s npx playwright install chromium` はダウンロード先cdn.playwright.devへのネットワークポリシー拒否（HTTP 403 Domain forbidden）で失敗。ポリシーを迂回していない。E2E成功は未確認。
- `git diff --check`: 成功。
- `git diff --stat`: 2 files changed, 69 insertions(+), 56 deletions(-)。
- `git diff --name-only`: package.json、package-lock.json。
- `git status -sb` / `git status --short`: 専用ブランチに上記2ファイルの未stage変更のみ。
- E2Eのnext devが自動追記したAGENTS.mdブロックは生成元を確認して除去。元のAGENTS.mdは維持。

## 実際の更新

直接依存: eslint-config-next 16.2.11 → 16.3.6（next 16.3.6に整合）。

High解消のために対象を指定して更新した推移依存: brace-expansion 1.1.12 → 1.1.21 / 2.0.2 → 2.1.7、minimatch 3.1.2 → 3.1.5 / 9.0.5 → 9.0.9、browserslist 4.28.1 → 4.29.3、flatted 3.3.3 → 3.4.4、js-yaml 4.1.1 → 4.3.2、undici 7.28.0 → 7.30.0。関連依存として@next/eslint-plugin-nextとBrowserslistデータ等が追従更新。無関係な一括更新は実施していない。

Commit SHA: なし。PR URL: なし。Verify / Vercel / PR競合 / auto-merge / merge / remote branch削除: 未実施・未確認。

停止理由: Highに修正版不在の経路が残り、かつブラウザー取得のネットワーク制限により必須E2Eが成功していない。

## 停止後の追加調査

今回の変更はこのドキュメント追加のみ。`package.json` と `package-lock.json` の既存差分は保持し、依存更新・再インストール・再監査・ブラウザーダウンロードは行っていない。旧PR #52およびそのブランチの操作なし。以下は導入済み依存とリポジトリ設定の静的調査であり、攻撃パターンを使った実証実験ではない。

### 残存High 5件の意味

| パッケージ（現在版） | 監査上の区分 | Highの根拠 |
| --- | --- | --- |
| `braces` 3.0.3 | 直接advisoryを持つ推移依存 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。深いbraceパターンによる再帰スタック枯渇 |
| `micromatch` 4.0.8 | 上位パッケージの集計 | `braces` のHighが伝播 |
| `fast-glob` 3.3.1 | 上位パッケージの集計 | `micromatch` 経由で伝播 |
| `@next/eslint-plugin-next` 16.3.6 | 上位パッケージの集計 | `fast-glob` 経由で伝播 |
| `eslint-config-next` 16.3.6 | 直接依存だが上位パッケージの集計 | Next ESLint plugin経由で伝播 |

独立したHigh advisoryが5件あるという意味ではない。直接依存であることと、自身に直接advisoryがあることは別。修正版の有無は前回確認時点で「なし」であり、今後の公開状態は再確認が必要。

### 問題のパターンを渡せる箇所と影響

確認した具体的な呼出経路:

```text
ESLintの @next/next/no-html-link-for-pages ルール
  → getRootDirs(context)
  → settings.next.rootDir（string または string配列）
  → fast-glob.globSync(..., { onlyDirectories: true })
  → デフォルト有効のbraceExpansion
  → micromatch.braces(pattern, { expand: true, nodupes: true })
  → braces(pattern, options)
```

根拠は導入済みの以下の実装:

- `node_modules/@next/eslint-plugin-next/dist/rules/no-html-link-for-pages.js:168`
- `node_modules/@next/eslint-plugin-next/dist/utils/get-root-dirs.js:15` と `:24`
- `node_modules/fast-glob/out/settings.js:24`
- `node_modules/fast-glob/out/managers/tasks.js:26`
- `node_modules/fast-glob/out/utils/pattern.js:137`
- `node_modules/micromatch/index.js:451`

リポジトリの `eslint.config.mjs` は `settings.next.rootDir` を設定していない。導入済み `eslint-config-next` の実装にも同設定は見当たらない。さらに `node_modules/.bin/eslint --print-config app/page.tsx` で有効設定を確認し、`settings.next` がなく、対象ルールがエラーとして有効（`[2]`）であることを確認した。rootDir未指定の場合、この関数は `context.cwd` を返し、`fast-glob` を呼ばない。

| 入力を操作できる主体・箇所 | 確認結果と影響 |
| --- | --- |
| 公開アプリの利用者が送るフォーム、URL、保存データ | `app`・`e2e`・プロジェクト設定で関連パッケージの直接呼出や、利用者入力を `settings.next.rootDir` に渡す箇所は見つからなかった。この経路による本番HTTP経由の攻撃可能性は確認できていない |
| PRのESLint設定を変更できる投稿者 | PRで `eslint.config.mjs` に細工した `settings.next.rootDir` を加えると、CIのlint時に上記の処理へ入力を渡せる構造。実際に脆弱性を発現させるパターンと到達は未実証。任意の設定コードを実行できる権限との重なりも考慮が必要 |
| 設定を変更できない投稿者がアプリソース、リンク文字列、ファイル名だけを操作 | 確認した実装ではJSXの `href` やファイル名がrootDir globへ変換される箇所はなかった。単にbraceを含むファイル名を追加するだけで本件を発現できるとは判断していない |
| 開発者のローカル設定、将来のmonorepo設定、共有設定・依存の変更 | `rootDir` に外部由来のglobを導入すれば攻撃面が変わる。通常の `npm run lint` でも該当ルールが実行されるため、該当パターンが渡れば開発環境のlintプロセスも停止し得る |

CIは `.github/workflows/ci.yml` の `pull_request` を起点にチェックアウトしたコードで `npm ci`、coverage、lintを実行する。該当処理が異常終了するとVerifyは失敗し、後続のE2E・buildへ進めなくなる。CI jobには20分の上限があり、`contents: read` とダミー環境値を設定しているが、これを脆弱性の解消とは扱わない。advisoryが直接述べる影響は可用性（Nodeプロセスの未捕捉RangeErrorによる終了）であり、本件による秘密情報の読取りやコード実行は確認していない。

現在の設定では確認したglob呼出が省略されるため到達性は限定的と考えられる。ただし、開発依存という分類だけで安全とは判断せず、監査のHighは残存リスクとして維持する。

未確認事項:

- 実際の悪意あるパターンによる、本リポジトリのCI／ローカルlintでの再現。今回PoCは実行していない。
- `app/page.tsx` 以外の全ファイルに対する有効設定の動的検査、間接ロードされる依存全体・外部ツールまで含めた全経路の網羅。
- GitHubで外部PRのCI実行に承認が必要か、ruleset・required checks・Vercel権限等のリモート設定。今回リモート状態は確認していない。
- 上流で今後修正版が公開されたか。記載した公開版情報は前回調査の記録。

### Playwright環境

| 項目 | 確認結果 |
| --- | --- |
| パッケージ | `@playwright/test`・`playwright`・`playwright-core` は1.62.1 |
| 要求ブラウザー | Chromium / Chrome Headless Shell 151.0.7922.34、revision 1234（`node_modules/playwright-core/browsers.json`） |
| プロジェクト標準 | `playwright.config.ts` のChromiumプロジェクトは `devices["Desktop Chrome"]` を使用。独自 `executablePath`・`channel` 指定なし。CIは `npx playwright install --with-deps chromium` |
| 現在のキャッシュ指定 | `PLAYWRIGHT_BROWSERS_PATH`・`XDG_CACHE_HOME` は未設定 |
| 標準キャッシュ | `/home/agent/.cache/ms-playwright` は存在せず、対応実行ファイルなし |
| 前回の一時キャッシュ | `/tmp/daily-affirmation-playwright` には `.links` のみ。対応実行ファイル・完了マーカーなし |
| その他の読み取り確認 | `/opt`・`/workspace` に対応実行ファイル／完了マーカーは見つからず、`/ms-playwright` は存在しない。`/root/.cache` は権限不足で確認できず、別ユーザーの非標準キャッシュとして利用していない |

前回の失敗記録（秘密情報・署名付きURLを含まない）:

- E2E起動エラー: `browserType.launch: Executable doesn't exist at /home/agent/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`。
- インストールURL: `https://cdn.playwright.dev/builds/cft/151.0.7922.34/linux64/chrome-linux64.zip`。
- HTTPステータス: `403`。
- 本文／エラー: `Domain forbidden`、`Download failed: server returned code 403`、最後に `Failed to install browsers`（終了コード1）。前回はPlaywrightインストーラー内で同一URLが自動再試行された。
- 標準キャッシュへの先行インストール試行は `ENOENT: no such file or directory, mkdir '/home/agent/.cache/ms-playwright'` で失敗。その後一時キャッシュを指定した試行で上記403を確認した。

今回はダウンロードを繰り返していない。対応ブラウザーがないため `timeout 600s npm run e2e` は実行していない。**ブラウザー未導入のため動作検証未実施**。前回の67件失敗はブラウザー起動前の環境エラーであり、67件のアプリ機能不具合と判定したものではない。

### 安全な更新分を独立PRにする条件

技術的には、現在の2依存ファイルと本ドキュメントを「修正版があるHighの削減とNext ESLint版の整合」という限定目的のPRにできる。全High解消のPRとして完了扱いにすることはできない。現時点ではE2Eが未検証のため、作成可能な状態には達していない。

必要な条件:

1. 残存Highの直接advisory・到達性・未確認事項を明記し、部分対応の範囲で進める判断を得る。前回の文書追加時の依頼は調査・文書保存のみで、commit・push・PR作成の許可はなかった。後続の許可と現状は末尾に記載する。
2. 管理されたネットワーク設定で公式Playwright配布先への取得を許可するか、同じPlaywright revisionに対応する公式ブラウザーを標準キャッシュへ事前導入する。非公式配布元・別バージョン・独自executablePathへ置換しない。
3. 標準構成で実行可能になった時点で `timeout 600s npm run e2e` を1回実行し、成功を確認する。以前成功したtest・coverage・lint・buildは対象に変更がなければ繰り返さない。依存や設定を修正した場合は必要な検証を再実行する。
4. 将来PR化するときは最新mainとの差分・競合・同目的PRを再確認し、全依存・本番依存監査を実行時点の結果として更新する。Verify・Vercel・競合・rulesetを実状態で確認する。
5. Highが残る間は元依頼の条件に従い `audit:all` とCI追加を見送る。部分対応PRのために失敗を無視する監査・CI設定、force fix、Nextダウングレード、根拠のないoverridesを導入しない。

次に必要なのは、公式ブラウザー取得を可能にする環境対応と、残存Highを明示した部分対応PRを認めるかの判断。上流修正版が出た場合は全High解消を再検討する。今回commit・push・PR作成は行わず、現在の未コミット変更を引き継ぐ。

### 今回の最終確認

- `git diff --check`: 成功。新規ドキュメントも空白エラーを別途確認。
- `git diff --stat` / `git diff --name-only`: 既存依存2ファイルの差分を維持。未追跡の本ドキュメントは通常のdiff集計に含まれないため `git status --short` で確認。
- `git status -sb` / `git status --short`: 同一ブランチ、依存2ファイルは未stage変更、本ドキュメントは未追跡。
- test・coverage・lint・build・監査: 今回はドキュメント追加と読み取り調査のみのため再実行を省略。前回成功／残存結果は上記に保持。
- commit SHA・PR URL: なし。旧PR #52とそのブランチは操作していない。


## 部分対応の許可後の環境確認（2026-10-06 05:50 JST）

全High解消ではなく、修正可能な依存の更新とNext ESLint版の整合を部分対応PRとして進める許可を得た。残存Highを解消済みとは扱わず、既存auditを維持し、auditの必須CI化は行わない。commit・push・通常PR作成の許可は、本番依存監査および対応ブラウザーでのE2E成功を条件とする。旧PR #52とそのブランチは操作しない。

### 確認した実行環境

- 現在接続された管理クラウド環境は稼働中。環境状態APIの観測は現在のもので、HTTPポリシーはrestricted。ただしポリシー適用状態は `unknown` であり、APIだけで通信成功を保証できない。
- APIの有効許可一覧と実行環境の `/etc/codex/network-policy.json` の双方に `cdn.playwright.dev` はない。
- 対応するChromium／Headless Shellは151.0.7922.34、revision 1234のまま。
- 標準 `/home/agent/.cache/ms-playwright` と `/ms-playwright` は存在しない。一時 `/tmp/daily-affirmation-playwright` は `.links` のみで、対応ブラウザーはない。Playwrightのキャッシュ指定環境変数も未設定。
- このチャットで選択された実行環境は現在の1環境のみで、利用可能なツールから別の正規実行環境を確認・選択する手段は見つからなかった。別環境が世界中に存在しないと判断したものではない。
- 同じ403となったダウンロードの再試行はしていない。今回のHTTP疎通は未実測で、403は前回の実測記録。公式配布先を許可する設定変更や対応ブラウザーの導入を示す証拠がなく、実行可能な環境は確認できなかった。

### 検証・完了処理の状態

**ブラウザー未導入のため動作検証未実施**。今回 `timeout 600s npm run e2e` は実行していない。環境利用可能後に実行する指示の `timeout 300s npm ci`、`timeout 300s npm run audit:prod`、全依存の `npm audit --json` も今回未実行。過去の監査結果は上記に保持するが、今回の日時で取得した結果として扱わない。全依存監査は前回もHighが残って終了1で、成功していない。

依存・コードは前回の検証成功時から変更していない。前回実行した `timeout 300s npm run test`、`timeout 300s npm run test:coverage`、`timeout 300s npm run lint`、`timeout 300s npm run build` の成功結果を保持し、今回は再実行を省略。

部分対応の判断は済んだが、E2E成功条件が未達のためstage・commit・push・PR作成は未実施。commit SHA・PR URLはなし。codexラベル、Squash auto-merge、Verify・Vercel・競合・マージ・作業ブランチ削除は未実施／未確認。残存advisoryと到達性・限界は上記の評価を引き継ぎ、将来PR本文にも明記する。

### 次に必要な環境対応

管理されたネットワーク設定で公式Playwright配布先 `cdn.playwright.dev` と、公式インストーラーが必要とするリダイレクト先への接続を許可するか、同じPlaywright版・revisionに対応する公式ブラウザーが導入可能な正規環境をこのチャットへ接続する。別の正規環境で実行する場合も、現在の3ファイルの未コミット変更を保持・移送して同一依存で検証する。非公式配布元、別revision、監査・テストの失敗無視を使用しない。

環境復旧後、最終依存でnpm ci、本番監査、全依存JSON監査（非ゼロ終了も記録）、`timeout 600s npm run e2e` を実行する。本番監査とE2Eの成功後にのみ指定3ファイルをstage・commitし、PR以降の処理へ進む。
