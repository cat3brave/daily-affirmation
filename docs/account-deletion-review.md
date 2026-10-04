# アカウント削除：実DB監査と実装レビュー

2026-10-04 JST。対象プロジェクト `ehoqhuhccuzqthnzinvn`。基点main `50164095e5a8f46cc24c95e5abf6180d235160d1`。

## 実施範囲

Supabaseへの操作は読み取りのみ。実DBへのDDL、権限変更、データ削除、実ユーザー削除、メール送信、秘密鍵の取得・設定はしていない。アプリ実装とモックテストを追加したが、公開機能は既定で無効。本資料のSQLは `supabase/review/account-deletion/` のレビュー用提案で、migrationディレクトリ外にあり自動適用されない。PostgreSQL・Supabase CLI・Dockerがこの実行環境にないため、提案SQLとAuth実機の削除試験は未実行。

## 確認済みの実DB

| テーブル | 所有列 | FK名 | 現状の削除動作 | 提案 |
| --- | --- | --- | --- | --- |
| todos | user_id | todos_user_id_fkey | NO ACTION | CASCADE |
| bloom_logs | user_id | bloom_logs_user_id_fkey | NO ACTION | CASCADE |
| profiles | id | profiles_id_fkey | NO ACTION | CASCADE |
| favorite_affirmations | user_id | favorite_affirmations_user_id_fkey | CASCADE | 維持 |
| three_good_things | user_id | three_good_things_user_id_fkey | CASCADE | 維持 |

全5テーブルでRLS有効。FKは検証済み、遅延なし。Authに存在しない所有者を参照する行は0。監査ロールpostgresのBYPASSRLSとread_only=onを確認。Storageのbucket/object/multipart/analytics/vectorは監査時0件。追加のアプリテーブルやpublic view、アプリ削除RPC、Edge Functionは検出されなかった。auth/publicに独自の行トリガーなし。Auth管理内部テーブルやログの保存期間の保証はしない。

未ログインのanon、既存ユーザーA/Bのauthenticatedにロール・JWT claimsをトランザクション内だけで設定し、SELECTの件数を照合。anonは全5テーブル0件、A/Bは本人件数と一致し他人行0件。これはHTTP/JWT発行試験ではない。todosは空なので、行のある場合の分離試験は残る。INSERT/UPDATE/DELETEの実試験は実施していない。

## 権限の評価

5テーブルのTRUNCATEはanon/authenticatedへの直接付与。提案02でその10個だけ取り消し、RLSと通常CRUDおよびservice_roleを維持する。TRUNCATEはRLSで保護されないが、通常のREST APIから直接実行できると断定していない。

`public.rls_auto_enable()` はpostgres所有のSECURITY DEFINER、戻り値event_trigger、固定search_path=pg_catalog。`ensure_rls` のDDL event triggerから使用される。anon/authenticatedはpublic schemaのCREATE権限も他ロールへの昇格権限もない。関数を普通の削除RPCとみなして実行・悪用検証しない。Security Advisorは実効EXECUTEについて警告するが、これだけで通常RPCから悪用可能とは認定しない。

実行権限はPUBLIC由来とanon/authenticatedへの直接付与の両方がある。提案02は両方を取り消し、postgres/service_roleは維持する。イベントトリガーのSECURITY DEFINERや本体は変更しない。隔離環境で通常の管理DDL後にRLS自動有効化が動くことを確認する。

profiles/todosのUPDATEはWITH CHECK省略時にUSINGの本人条件が適用される。省略だけを理由に脆弱性とせず、今回RLS変更はしない。bloom_logsの重複ポリシー整理、漏えいパスワード保護設定、user_id索引追加は別レビュー。

## SQL案と確認手順

1. `04-verify.readonly.sql` を各トランザクション別に実行。対象project refは接続側で確認。可視性、3 FKのNO ACTION、他2 FKのCASCADE、5テーブルの件数・fingerprint、ACL、event triggerを採取する。本文・UUID・鍵を公開しない。最終ブロックの操作テーブル確認は案03適用後用。
2. `01-cascade.proposed.sql` は3 FKの現状ガード付き。ロック5秒、statement30秒。3 FKを1トランザクションで変更し、検証済み制約を作る。行を消すSQLではないが、その後のAuth削除の連鎖を変える。ロック競合・タイムアウトは適用成功と扱わず、ROLLBACK・再監査する。
3. `02-privileges.proposed.sql` は最小の権限取消。01と別の変更単位でレビュー可能。
4. `03-operation-store.proposed.sql` はアプリの二重実行防止・結果照合に必要な6番目のテーブル。Auth FKを付けず削除結果を保持する。通常クライアントの権限・ポリシーは与えない。ID、所有ID、セッションID、受付票ハッシュ、状態、有効期限だけを保存する。
5. 04を再実行。3 FKだけCASCADEへ変化、全5 FKがvalidated、既存5テーブルの件数・fingerprint一致、RLS不変、anon/authenticatedのTRUNCATEと対象関数EXECUTEがfalse、service_roleは既存権限維持、イベントトリガー有効を確認。並行書込みによる差とDDLの影響を区別するため、比較は静かな時間帯に行う。
6. Advisorを再実行。残った警告を区別する。保存・表示など既存操作を合成A/Bで確認。

fingerprintは監査時の小規模データ向けで、厳密な暗号学的証明ではない。大規模化した場合はストリーミング比較に置き換える。全行のbefore/after比較は今後の適用担当者が管理下で行う。

## ロールバック

先にACCOUNT_DELETION_ENABLED=false。進行中・unknownを照合してから `05-rollback.proposed.sql` の必要なブロックをレビューする。3 FKを同じ名前のNO ACTIONへ戻せるが、削除済みデータは復元できない。権限の復旧ブロックは過剰権限を戻すので、障害原因と確認できた場合に限る。操作テーブルは結果照合のため保持し、自動DROPしない。適用直前に採取した定義・ACLがこの監査から変わっていれば、このロールバックをそのまま使わない。

## アプリ実装

- 専用 `/account/delete` 画面。バックアップまたは保存不要の選択→確認済みメールへのOTP→最終確認→POST削除。GETやメール確認だけでは削除しない。
- Google再OAuthの画面表示だけを再認証扱いにしない。今回はGoogle/メール利用者とも確認済みメールのOTPで再確認する代替方式。アドレスはサーバーのgetUser、セッションIDはgetClaimsの検証済みsub一致から取得。OTPで得たユーザーIDも一致必須。MFA利用者への保証は今回未検証、公開前に別確認。
- 管理クライアントはserver-only。再認証用の公開クライアントと分離し、persistSession/autoRefreshTokenを無効化。OTP後の一時セッションはlocal signOut。パスワード・コード・JWT・メール本文をログやDBに保存しない。
- 本人確認証跡は10分以内、確認成功後の最終操作は最大5分。検証試行は最大5回。ID/セッション一致とDBの状態比較更新で単回実行を保証する設計。クライアントからuserId指定は拒否。
- 受付票はランダム32byte、DBはSHA-256、CookieはHttpOnly/SameSite=Strict、本番Secure、パス限定、有効1時間。削除後は受付票による結果照会だけ許可する。操作番号だけでは照会できない。
- 通信切断・途中エラーはunknown。Admin hard deleteを再送しない。管理APIの明示的user_not_foundと5テーブルの本人行0件を確認して成功へ収束。403/一般404/timeoutだけを成功と扱わない。
- 成功時だけ本人の2種類のキャッシュ/下書きを消去。別アカウントのキーと現在ログイン中の別アカウントのセッションは保持する。削除済みIDの小さなマーカーで古いタブのキャッシュ再作成を抑止。再表示時の認証確認とstorageイベントで状態を破棄する。ブラウザーがstorageを拒否する場合の全タブ保証はしない。
- exportUserDataの既存JSON形式は今回変更しない。profilesは既存エクスポート対象外であり、削除案内のバックアップは全データの復元保証ではない。

## 有効化条件・未解決事項

`ACCOUNT_DELETION_ENABLED` / `ACCOUNT_DELETION_DB_VERIFIED` / `ACCOUNT_DELETION_EMAIL_OTP_VERIFIED` の3つをtrueにし、正確なoriginとサーバー専用管理キーを設定するまではUI/APIとも停止する。フラグは実機検証の代用品ではない。このPRではすべて既定false。デプロイ先設定は変更していない。

- Supabaseのブランチ一覧ではmainのみ。隔離環境を作成していない。有料ブランチ作成もしていない。
- 5テーブルに人工A/Bデータを用意し、移行前後の全件一致、削除Aのみ消失、B全値不変、FK/trigger失敗注入時のAuth APIを含む原子性を検証する。
- Storageを導入する場合、SQLで物理ファイルを消さない。Storage APIとの原子性・所有者判定を別設計する。
- 古いJWTで直接REST/RPC/Storage/サーバー処理を確認。本人行消失・FKによる再作成拒否・他人へのRLSを確認する。機密経路が残れば限定的なsession存在検証を追加し、auth.sessions全体をクライアント公開しない。
- OTPテンプレートにコードを表示する設定、配信制限、Google既存ユーザーのメールOTP、ID一致、MFA、メール変更競合を実機確認する。OTP送信で新規ユーザーを作らない。
- unknown/processingから自動再試行しない。操作受付票を失った場合や1時間経過後は、管理者が操作IDと実DBで照合。未送信の期限切れ証跡は次のprepareで削除可能。結果記録の保存期限・運用削除手順は本番公開前に確定し、unknownは未照合のまま削除しない。
- 本番のバックアップ・ログ・外部AIサービスの消去期限、全端末の即時消去は保証しない。

## ローカル検証とレビュー状態

ブランチ `codex/account-deletion-review`、作業ツリー `/workspace/scratch/3350b2f8cd2d/daily-affirmation`。既存変更を維持して継続した。以下は実行結果であり、本番の実機試験の代わりではない。

| 実行コマンド | 最終結果 |
| --- | --- |
| `timeout 300s npm run test` | 成功、45ファイル329件 |
| `timeout 300s npm run test:coverage` | 成功、329件。Statements 91.04%、Branches 84.82%、Functions 95.31%、Lines 94.21%。全閾値達成 |
| `timeout 300s npm run lint` | 成功 |
| `timeout 300s env NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder-anon-key GEMINI_API_KEY=ci-placeholder-gemini-key npm run build` | 成功、型検証・全ルート生成完了。値はテスト用プレースホルダー |
| `timeout 300s npm run audit:prod` | 成功、0 vulnerabilities |
| `timeout 300s npx playwright install chromium` | 失敗、終了コード1。取得物をZIPとして展開できない |
| `timeout 300s npx playwright install --only-shell chromium` | 失敗、終了コード1。同じ原因 |
| `timeout 300s npm run e2e` | 初回失敗、終了コード1。66件すべて標準Chromium実行ファイル不在で起動前に失敗 |
| `timeout 300s npm run e2e -- --config=/tmp/account-deletion-playwright.config.ts --workers=2` | 最終成功、66件、1.6分。下記の一時Chromium環境を使用 |
| `git diff --check` | 成功 |

いずれもタイムアウトなし。Playwright配布URLへのHEAD確認はHTTP 200 / Content-Type text/html / 195 bytesであり、ZIPを取得できなかった。配布側と実行環境のどちらが原因かは未確定。依存バージョン変更やテストの省略で回避していない。初回の通常テストはserver-only解決エラー、初回buildは新規テストの型注釈不足で失敗したが、それぞれテスト専用aliasとParameters型注釈で修正し、再検証に成功。型注釈修正後はcoverageで通常テスト全件も再確認した。

再開時も標準配布先は「Site Unavailable」。OSパッケージ管理はsetgroups/seteuidの権限制約で使用できなかった。リポジトリ外の `/tmp/account-deletion-browser` に `timeout 300s npm install --prefix /tmp/account-deletion-browser --ignore-scripts --no-audit --no-fund @sparticuz/chromium@153.0.0` でChromium 153.0.8010.0を用意した。パッケージの自動展開もchown制約で失敗したため、同梱Brotliを展開し、tarを `--no-same-owner` で取り出した。アプリのpackage.json・lockfileは変更していない。

一時Playwright設定は既存設定を継承し、実行ファイル・フォント・共有ライブラリの場所、設定移動に伴う絶対パス、レポーターを指定した。テスト・判定・タイムアウト・認証モックは変更していない。フォント設定不足でブラウザーがSIGTRAP終了した初回は61件失敗・5件成功。`FONTCONFIG_PATH=/etc/fonts` に修正して削除E2E2件の成功を確認し、全66件の成功を確認した。最終結果は標準配布のChromium 151と同一環境の保証ではない。PRのCIでは既存設定どおり標準ブラウザーを使用し、その結果も別途確認する。

通常テスト・coverage・lint・build・依存監査は前回成功後に対象コードを変更していないため、今回の再実行は省略。ローカル必須検証の成功を確認してcommit/PRを作成する。SHA・PR URL・CI結果は最終報告を参照。auto-merge・merge・本番適用・実ユーザー削除は行わずレビュー待ちとする。PostgreSQL実行環境がないため提案SQLは未実行。Next devが追加したAGENTS.mdの自動生成ブロックは除去し、既存の指示を維持した。

## 変更ファイル

- SQL案：`supabase/review/account-deletion/01-cascade.proposed.sql`、`02-privileges.proposed.sql`、`03-operation-store.proposed.sql`、`04-verify.readonly.sql`、`05-rollback.proposed.sql`
- 削除画面/API：`app/account/delete/page.tsx`、`DeleteAccountForm.tsx`、`DeleteAccountForm.test.tsx`、`request/route.ts`、`request/route.test.ts`
- 状態管理/管理API：`app/lib/accountDeletion.ts`、`accountDeletion.test.ts`、`accountDeletionServer.ts`、`accountDeletionServer.test.ts`
- 削除後のブラウザーデータ：`app/lib/deletedAccount.ts`、`deletedAccount.test.ts`、`userLocalStorage.ts`、`threeGoodThingsDraft.ts`、`app/hooks/useAuthUser.ts`、`useAuthUser.test.tsx`、`useFavoriteAffirmations.ts`
- 案内・設定・検証：`app/login/page.tsx`、`app/privacy/page.tsx`、`.env.example`、`playwright.config.ts`、`vitest.config.mts`、`e2e/account-deletion.spec.ts`、`README.md`、本資料

## 公式資料

- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/database/postgres/cascade-deletes
- https://www.postgresql.org/docs/17/sql-createpolicy.html
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

実装前設計 docs/account-deletion-design.md は過去の計画として残し、本資料を今回の差分・実機ゲートの記録とする。commit/PR/CI結果は最終作業報告を参照。auto-mergeは行わない。既存自動化の起動条件であるCodex TaskリンクはPR本文に付けない。
