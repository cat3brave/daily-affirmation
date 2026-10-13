# 利用者別AI利用枠のDB準備案

## 状態と範囲

2026-10-14（日本時間）の準備資料。**未適用・アプリ未接続・制限未有効化**。
このPRがマージされても利用者別の回数制限は有効にならない。
最新main `9ca104fc47b5b1d1c81498fa9874164b81e50276` から専用ブランチで作成した。
開始時は `work`、`git status -sb` は `## work`、`git status --short` は空。
端末のfetchはプロキシ接続エラーのため、GitHub連携のmainブランチ情報とHEAD一致で確認した。
旧PR #52、そのブランチ、既存アカウント削除SQL案には変更・適用を行わない。
`supabase/schema.sql`、migration、アプリ、依存関係、認証、CI、本番設定は変更しない。

## 暫定仕様

| 項目 | 設計 |
| --- | --- |
| 利用枠 | アファメーション生成・翻訳で共通。操作種別を引数・キーにしない |
| 日次上限 | 利用者ごとに日本時間の1日20回。Asia/Tokyoの午前0時に切替 |
| 短時間上限 | 利用者ごとに直近60秒で3回。固定分単位の窓ではない |
| 時刻 | DBの `clock_timestamp()`、行ロック取得後に評価 |
| 消費 | 許可された確保1回を1回とする。確保後のGeminiエラー・429・タイムアウトは返却しない |
| 非消費 | 不正入力・未認証・APIキー不足はRPCより前に処理。枠超過の拒否も両枠非消費 |
| 再試行 | 自動再試行を追加しない。返却・減算・リセット用RPCなし |

20/日・3/60秒はこのアプリの設計・試験用の運用値であり、Google公式のAPI上限・無料枠・課金上限ではない。
複数アカウントによる利用やサービス全体の費用上限を防ぐ仕組みは別途必要。
公開RPCを本人が直接呼んでも本人の枠が消費されるだけで、Geminiは呼ばれない。
この入口単独ではアプリの入力検証・APIキー確認を保証できないため、その順序は将来のServer Action側の責務。

## 原子性と保存情報

`public.reserve_ai_usage()` を引数なしで1回呼び、同じトランザクション内で
内部 `ai_usage_private.reserve()` が確保を完了する。

1. `auth.uid()` がNULLなら認証エラー。任意ID・上限・現在時刻・減算値の引数はない。
2. PK `user_id` へのINSERT + `ON CONFLICT DO NOTHING` で初回競合を待つ。
3. 同じ利用者の行を `SELECT ... FOR UPDATE` でロック。
4. **ロック後**のDB時刻で日本時間の日付と `(now - 60秒, now]` の許可時刻を計算する。
   ちょうど60秒経過した時刻は除外。日付変更時も短時間枠は保持する。
5. 日次20・短時間3を両方確認。どちらか超過ならUPDATEせず拒否。
6. 両方許可の場合だけ、日次回数を1増やし直近時刻を追加する。

「別リクエストでSELECT後にUPDATE」の構成ではない。READ COMMITTEDでは
ON CONFLICTが待った後の次のSQL文でコミット済み行を取得し、行ロックで最新値を扱う。
REPEATABLE READ/SERIALIZABLEでは競合がエラーになる場合があり、呼び出し側は許可と扱わない。
本人の1行・PK競合だけを直列化する。全ユーザーのadvisory lockやテーブル排他ロックは取らない。
通常のテーブルロック・インデックス処理・FKのキー共有ロックは伴う。
Gemini通信中までDBトランザクションを保持せず、RPCをコミットしてから外部呼び出しする。

保存するのはUUID、日本時間の日付、日次回数、最大3件の許可時刻だけ。
拒否イベントを蓄積せず、利用者1人1行なので利用回数に比例して行数は増えない。
許可時に古い短時間時刻を除く。非活動ユーザーには最後の最大3時刻と日付・回数が残り、
履歴分析用途には使わない。入力文章・生成結果・メール・Cookie・トークン・APIキーは保存しない。
DBの壁時計の大幅な巻戻し/変更は通常運用の前提外であり、時刻同期と監視が必要。

戻り値は必ず1行：

| 列 | 契約 |
| --- | --- |
| allowed | boolean、許可時だけtrue |
| reason | `allowed` / `minute_limit` / `daily_limit` / `daily_and_minute_limit` |
| daily_remaining | 判定後の日次残り、整数0〜20 |
| minute_remaining | 判定後の短時間残り、整数0〜3 |
| retry_at | 許可時NULL。拒否時timestamptz。判定時点の最短再利用時刻 |

両制限超過では「次の日本時間午前0時」と「最古の直近許可時刻+60秒」の**遅い方**を返す。
再利用時刻は将来の許可を予約する値ではなく、その後の本人の利用で延びる場合がある。
残り回数は独立した各枠の残量で、一方が残っていても他方が0なら利用不可。

DB確保がコミットされた後に応答の通信が切れた場合、枠は消費済みの可能性がある。
この案にリクエストIDによる冪等性はない。無条件の再試行・二重確保・推測による返却をしない。
DBエラー、ロック/通信タイムアウト、NULL、0行・複数行、未知の理由、型・範囲不正、
allowed/reason/retry_atの矛盾などでは、将来の呼び出し側はGeminiを呼ばない。

## 権限と削除

- 公開入口は `public.reserve_ai_usage()` のみ。`SECURITY INVOKER`、authenticatedだけEXECUTE。
- 特権処理は非公開 `ai_usage_private.reserve()`。authenticatedにスキーマUSAGEと関数EXECUTEだけ付与する。
  SQL接続から内部関数を直接呼んでも同じ本人確認・固定制限が働く。
  `ai_usage_private` はSupabaseのExposed schemasへ登録しない。
- 内部関数はカウンターへの直接DMLを利用者へ付与しないため `SECURITY DEFINER` が必要。
  所有者は専用 `ai_usage_limit_owner`：NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS、DB・ロール作成不可。
  authスキーマUSAGEとauth.uid EXECUTE、新規スキーマ・テーブル・内部関数の所有権だけを持つ。
  postgresだけが管理用にこのロールのメンバーになる。クライアントロールには付与しない。
- テーブルはENABLE + FORCE RLS。専用所有者だけに `user_id = auth.uid()` のUSING/WITH CHECKを設定。
  通常の所有者もRLSの対象にし、認証ユーザーにはテーブル権限もRLSポリシーも付与しない。
  本人・他人ともテーブル参照、INSERT/UPDATE/DELETE/TRUNCATE、リセットは禁止。
- 全関数で固定 `search_path = pg_catalog, pg_temp`、テーブル・認証関数・内部関数は完全修飾。
  pg_tempを最後に置き、利用者が書けるpublicを探索しない。
- デフォルトPUBLIC EXECUTEとanon/authenticated/service_roleの不要な明示権限を、構築と同じトランザクションで剥奪。
  service_roleへ新たな権限を付与せず、そのキーを取得・追加・ブラウザーへ配布しない。
- `auth.uid()` の信頼は、Supabaseが署名検証したJWTをDBコンテキストへ設定する境界が前提。
  一般利用者へ直接SQL資格情報やclaim設定権限を渡さない。管理者が設定するfixtureは認証の実証ではない。
  Supabaseの匿名サインインはauthenticatedロールを使う別機能であり、この案は非NULL uidを持つアカウントとして数える。
  本アプリに匿名サインインを追加する場合は対象方針を別途決める。
- 新テーブルのFKのみ `auth.users(id) ON DELETE CASCADE`。ユーザー削除でその利用行も削除する。
  既存テーブル・既存削除機能は変更しない。削除済みuidでの確保はFKエラーで失敗する。
  既存JWTの失効まで保証する機能ではない。

## ファイルと隔離DB試験

`supabase/review/ai-usage-limit/`：

| ファイル | 用途 |
| --- | --- |
| 01-setup.proposed.sql | 手動構築案、権限設定を含む。名前衝突時は失敗し既存オブジェクトを上書きしない |
| 02-verify.readonly.sql | カタログ上の権限・所有者・RLS・関数設定のassertionと制約/ポリシー表示 |
| 03-fixture.local-only.sql | 使い捨てクラスタ専用、偽ユーザーA/B・auth.uidモデル・既存データのsentinel |
| 04-test-local.py | Python標準ライブラリだけの隔離クラスタ作成・複数接続試験・終了処理 |
| 05-rollback.proposed.sql | 今回の関数・表・スキーマ・専用ロールのみを削除。CASCADE/DROP OWNEDなし |

### 実行方法

Postgres 15/17（対象Supabaseと同じ版を優先）の `initdb`, `pg_ctl`, `psql` が
PATHにある、非rootのローカルOSユーザーで実行する。リポジトリ依存や本番資格情報は不要。

```sh
python3 supabase/review/ai-usage-limit/04-test-local.py --check
timeout 300s python3 supabase/review/ai-usage-limit/04-test-local.py
```

ランナーはURL・ホスト・既存DB名を受け取らず、自身が作成した一時クラスタのUnixソケットだけに接続する。
TCP listenは無効、継承PG環境変数を除去、ディレクトリは所有者限定。
fixture → 構築案 → 権限確認 → 下記試験 → ロールバック → sentinel確認を順に実施し、
finallyで自分のクラスタを停止・一時ディレクトリを削除する。
異常終了・外部timeout時に残ったクラスタは、表示された一時パスを確認し、そのクラスタだけ停止する。
他のDBへfixtureを流用してはいけない。管理者のfixture操作と実際のauthenticatedのRPC操作を分ける。

| 試験 | 検証内容・期待値 | 今回の実行 |
| --- | --- | --- |
| A/B独立 | 各自初回の日次残り19。Aのロック中もBが許可。所有者にもFORCE RLSでB非表示 | 未実施 |
| 認証・権限 | anon 42501、uidなし28000。他人参照・全直接DML・TRUNCATE・ALTER・owner切替拒否。任意ID引数は不存在 | 未実施 |
| 初回並行 | 12接続。先頭の初回確保を未コミットで保持し、11接続のDBロック待ちを観測して解放。許可合計3 | 未実施 |
| 日次残り1 | fixtureで19回に設定。同じ12接続・ロック待ちを観測。許可合計が正確に1 | 未実施 |
| 共通枠・拒否 | 両操作に同じRPCを使用。3回後拒否。日次拒否も含め前後の保存値一致 | 未実施 |
| 日付・60秒境界 | 管理fixtureの時計でJST 23:59:59→00:00:00、前日の時刻保持、ちょうど60秒の除外 | 未実施 |
| 両枠retry | 午前0時より60秒枠終了が遅い場合/早い場合の双方でmaxを返す | 未実施 |
| DBエラー・timeout | UPDATEに管理fixtureの例外トリガー→初回INSERTもrollback。確保後のゼロ除算もrollback。行ロックtimeoutで不変 | 未実施 |
| 削除・rollback | A削除で新利用行のみcascade。rollback後の新オブジェクト不存在、sentinelとB保持 | 未実施 |

時計fixtureは使い捨てDB内に管理者専用時計を作り、`pg_get_functiondef` で取得した
内部関数の**2箇所のclock_timestamp式だけ**を一時的に差し替える。引数や上限は変えない。
日付境界試験後に元の関数定義へ戻す。元の関数の実時計・実並行試験と、時計差替えによる境界試験は区別する。
本番SQLには試験用の時刻・上限パラメーターや時計関数を入れない。

### 今回実際に確認したこと

- `docker info --format '{{.ServerVersion}}'`：ソケット権限で利用不可。既存隔離DBと判断できる環境なし。
- `python3 supabase/review/ai-usage-limit/04-test-local.py --help`：成功。
- `python3 supabase/review/ai-usage-limit/04-test-local.py --check`：終了コード2、initdb/pg_ctl/psql不足。
  想定した未実施判定でDBへの書き込みなし。
- Pythonソースを `compile(source, path, 'exec')` で検査：成功（生成物なし）。
- SQLの設計・差分・公式資料による目視確認。**SQLの実行成功、原子性、権限の実証ではない**。
- アプリtest/coverage/lint/build/E2Eは省略：未適用SQL案・文書・DB検証補助のみで、アプリ実行コードに影響しない。
  既存CIのVerify・Vercelの結果はPRで別途確認する。

本番・共有DB・実ユーザー・実Geminiは使用していない。
全DB試験は未実施。ランナー自体のDB実行経路も未検証であり、準備資料としてレビューする。
さらに実Supabaseの隔離環境でJWT/PostgREST、実auth.uid、専用ロール作成/所有者変更、
既定権限・イベントトリガー、Exposed schemas、匿名/失効トークン、スキーマキャッシュを確認する必要がある。
ローカルfixtureはこれらの代替にはならない。Advisorsも未実施。

## 将来の導入手順（今回は実行しない）

1. 上記ランナーを隔離環境で完走し、DB版・実行ログ・並行時の許可数・権限・rollback結果を記録する。
   実Supabaseの使い捨て環境でもRPC権限/JWT境界を検証し、Advisorsで今回のオブジェクトを確認する。
   `03-fixture` は実Supabaseに適用しない。偽ユーザーをその隔離環境の正規Auth機能で準備する。
2. 本番適用は別作業で承認を得る。対象DB、管理ロール、既存同名オブジェクト不在、既定権限、
   postgresの専用ロール作成・SET/所有者変更権限を読み取りで確認する。環境制約があれば案を再レビュー。
   ai_usage_privateを非公開のまま保ち、01を1トランザクションで手動適用、02のassertionを確認する。
   必要ならその別作業でPostgRESTのスキーマキャッシュ更新を行う。今回migration登録はしない。
3. アプリ接続も別PR。既存 `app/actions.ts` と `app/lib/supabaseServer.ts` のgetUser方式を維持し、
   両Server Actionへ次の同じ順序を追加する：

   **入力検証 → getUserによる認証確認 → Gemini APIキー確認 → DBで利用枠を確保 → Gemini呼び出し**

   生成は外部入力を持たないため入力検証は実質不要、翻訳は現行の型・空文字確認と正規化を先に行う。
   Cookie対応サーバークライアントの本人JWTで引数なしRPCを呼び、service_roleを使わない。
   getAuthenticatedUserはID/emailだけを返すので、同じ本人コンテキストを保持するクライアント取得方法を別PRで設計する。
   単一の正常な許可行だけGeminiへ進め、拒否はreason/retry_atで案内する。
   DBエラー・timeout・不正戻り値でGeminiを呼ばないこと、確保済みエラー非返却・二重確保禁止、
   自動再試行なしを実行コードとテストで保証する。日付表示はJSTで行い、ブラウザー時計で判定しない。
4. 接続PRで不正入力/未認証/APIキー不足の非消費、両操作共有、Geminiエラーの消費、
   不明応答時の停止、複数サーバー並行、画面表示を隔離DBと偽Geminiで確認してから有効化する。
5. rollbackが必要ならまず将来のアプリ呼び出しを停止し、05を手動実行する。
   新利用表の記録だけは失われる。既存のアプリデータにDELETE/TRUNCATE/DROPは実行しない。
   未知の依存関係があればRESTRICTで停止し、CASCADEに変更しない。

## 公式資料の確認

- [Supabase database functions](https://supabase.com/docs/guides/database/functions)：invoker/definer、search_path、EXECUTE剥奪。
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)：auth.uidの未認証NULL、ロールと所有権の区別。
- [Supabase Auth architecture](https://supabase.com/docs/guides/auth/architecture)：Auth/JWTとDBの境界。
- [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)：特権関数の探索パスとPUBLIC EXECUTE、同一transactionでの権限設定。
- [PostgreSQL Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)：同じ行へのFOR UPDATEとtransaction終端での解除。
- [PostgreSQL Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)：READ COMMITTEDのON CONFLICT DO NOTHINGと次文のsnapshot。
- [PostgreSQL Date/time](https://www.postgresql.org/docs/current/functions-datetime.html)：clock_timestampとtransaction開始時刻の違い、AT TIME ZONE。
- [Supabase changelog](https://supabase.com/changelog)：Markdown取得はツールのcontent-type制約で失敗、HTML版を確認。
  [15.19/17.11変更](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)を確認し、
  今回利用しないltree/pgcrypto/btree_gist等の変更と区別。対象DBの版・更新状態は隔離検証/本番適用時に確認する。
