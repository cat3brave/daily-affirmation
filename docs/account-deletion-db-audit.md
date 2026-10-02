# アカウント削除前のDB監査・検証手順

## 範囲と確認状況

2026-10-02、`origin/main` をfetchし、PR #49のマージcommit `1f898bd27c11839ffec7d72ff0122935a306371b` が最新mainかつ作業HEADに含まれることを確認。作業ブランチは `codex/prepare-account-deletion-db-audit`。AGENTS.mdと[削除設計](account-deletion-design.md)を読んだうえで整備した。

**リポジトリで確認済み**は下表の定義・呼び出しだけ。**実DBではすべて未確認**。この作業ではDBへ接続せずSQLも実行していない。マイグレーション、FK/RLS変更、Auth Admin API、実アカウント削除、管理キー設定、UI実装を含まない。以下の監査実行は担当者の将来作業、ステージングでの変更・削除テストは別途承認された将来作業である。

| テーブル | schema.sqlで確認した所有列・主キー | auth.users(id)へのFK | 利用箇所 |
| --- | --- | --- | --- |
| public.todos | user_id uuid NOT NULL、default auth.uid()、id uuid PK | NO ACTION（ON DELETE指定なし） | app/exportDataAction.ts。現在のapp内にToDo書込み呼出しは見つからない |
| public.bloom_logs | user_id uuid NOT NULL、id uuid PK | CASCADE | useFlowerGarden、BloomGraph、exportDataAction |
| public.three_good_things | user_id uuid NOT NULL、id uuid PK | CASCADE | ThreeGoodThingsCard、exportDataAction |
| public.favorite_affirmations | user_id uuid NOT NULL、id uuid PK | CASCADE | useFavoriteAffirmations、exportDataAction |

`three_good_things(user_id,date)` と `favorite_affirmations(user_id,text)` はunique **index**。4テーブル間のFK・独自trigger・関数・GRANT・FORCE RLSはschema.sqlに定義されていない。全4テーブルでENABLE RLS、所有者条件がある。todosのpolicy対象はPUBLIC、他はauthenticated。bloom_logsはSELECT/INSERTのみ、favorite_affirmationsはSELECT/INSERT/DELETE、他2つは4操作。todosのUPDATEはWITH CHECK省略時にUSINGを引き継ぐ。RLSとSQL権限は別々に照合する。

リポジトリのSQLは `supabase/schema.sql`、構成メモは `docs/supabase-schema.md`。構成メモのDROP TABLE例は監査・移行に使わない。CREATE TABLE IF NOT EXISTSは既存FKの修正にならない。app・proxy.tsのSupabase利用を照合した範囲ではStorage・RPC呼出しは見つからないが、実DBに存在しないことの根拠にはならない。SSRは公開設定のクライアントでgetUserを照会、ブラウザーは直接テーブルを読み書きする。Auth内部テーブル・追加スキーマ・Storageの定義はリポジトリにない。

## 実行前の条件と記録

- 権限のあるDB担当者が既存の安全な接続手段を使用する。接続文字列、鍵、メール、JWT、Cookie、本文を記録・共有しない。アプリへの管理キー設定は不要。
- [メタデータSQL](../supabase/audit/account-deletion-metadata.sql) は番号順、各SELECTを別実行単位とする。[Storage SQL](../supabase/audit/account-deletion-storage.sql) は条件を満たしたblockだけ選ぶ。schema.sqlを実行しない。自動migrationやアプリから呼ばない。
- 接続側でread-only transactionを指定し、01のtransaction_read_onlyがonであることを確認する。各実行単位を読み取り専用transactionで囲み、終了はROLLBACKとする。監査ファイル自体はSELECTのみ。read-onlyでも外部副作用を持つ関数は安全とは限らないので、発見したRPCを呼ばない。
- 必要権限はpg_catalogの各relationのSELECTと、使用する組込みcatalog/has_*関数の実行権限。Storageの任意集計にはstorage schemaのUSAGEとbucketsのid/public、objectsのbucket_id/選択した所有列、auth.usersのidのSELECTが必要。Auth本文やメールのSELECTは不要。権限変更はこの手順に含めず、足りなければ既に適切な権限を持つ担当者に引き継ぐ。
- カタログの完全な可視性を担当者が保証する。情報スキーマだけに頼らない。Storage集計にはRLSで絞られない可視性が必要。所有ロールでもFORCE RLSの影響を受け得る。01/02/08でsuperuser、BYPASSRLS、relation所有者、FORCE RLSを照合し、全件可視性が証明できなければ集計を全件結果にしない。
- 大量のrole×relation/function結果やStorage全件集計は負荷がある。担当者が実行時間上限・実行時間帯を決める。タイムアウトは「不在」ではない。各単位は異なる時点の結果になり得るため、監査中のDDL変更も記録し、変更があれば関連項目を再確認する。

実行単位の枠は次のとおり。実際のSELECTは監査ファイルから1文ずつ入れる。01もこの枠内で確認する。SQL Editorが複数文を同じtransactionで実行するか担当者が確認し、read-onlyを保証できない環境では実行しない。

```sql
BEGIN TRANSACTION READ ONLY;
-- ここに監査ファイルのSELECTを1文だけ入れる
ROLLBACK;
```

メタデータSQLはPostgreSQL 10以降のcatalog（polpermissive等）を前提にしているが、対象DB版での互換性は未検証。新しい版のrole継承/SET ROLE条件やviewのsecurity_invoker、公開API schema設定も別途照合する。08はそのroleとして現在実効な権限であり、可能なSET ROLE先すべての組合せを自動判定するものではない。

記録表には環境の安全な別名、日時、対象Git SHA、SQL番号、DBバージョン、監査ロール、可視性根拠、結果要約、差異、担当者、次の判断を残す。SQLファイルを変更した場合はそのSHAも記録する。出力は構成メタデータとして制限された保管先で扱い、PRへ本番出力を貼らない。

| 状態 | 記録条件 |
| --- | --- |
| 確認済み | 実行成功し必要範囲の可視性も確認、期待結果と照合済み |
| 差異あり | 取得できた定義が期待と異なる。取得できたことと適合したことを区別 |
| 取得不可 | 実行して権限拒否・未対応column/catalog・timeout等。SQLSTATEと安全な理由を記録。未確認事項は残る |
| 未確認 | 未実行、可視性不明、スキップ、候補検出だけで意味未レビュー |
| 非該当 | 担当者が完全な可視性で不存在や未使用を確認した場合だけ。空結果だけでは認定しない |

PostgreSQL版やSupabase Storage版による差を無視してSQLを改変しない。欠けるcolumnは04で確認し、代替取得法を別レビューする。permission denied後に同じ失敗を繰り返さず、別単位を新しいread-only transactionで実行する。失敗transactionの後続結果を採用しない。

## 実行順・期待結果・判断基準

| 順序 | 確認項目・期待結果 | 差異の扱い |
| --- | --- | --- |
| 01 → 02 | version、監査ロール、read-only、4テーブルとauth.usersの存在・relation種別。4テーブルは通常table、RLS有効。FORCEはリポジトリに指定なし | 必須table未取得・RLS無効は実装開始の前提未成立。FORCE/所有者は運用差としてレビュー |
| 03 | 全FKからauth.usersを参照するものを抽出し、参照元を更に参照するFKを再帰的に手で辿る。4テーブルへの全入参照・出参照も確認。auth.sessions等Auth内部の連鎖を含む。列対応は配列の同じ順番。4テーブルは上表どおりでvalidated=trueを期待 | todosのNO ACTIONは既知の実装阻害要因。既にCASCADEなら移行不要とは即断せず履歴確認。RESTRICT/SET NULL/SET DEFAULT、未検証、遅延、別列・複合FK、追加連鎖を個別レビュー。追加tableの無条件CASCADE化はしない |
| 04 → 05 | user_id/PKの型・NOT NULL、default、全制約とindex。unique index2本を照合。user_id先頭indexの有無も負荷評価へ渡す | CHECK/排他制約は名前・種別だけで意味は未確認。式index/partial index、partition、view、foreign tableは別レビュー。移行前の孤児行・全データ不変の検証は別の承認済み作業へ |
| 06 | auth.users、4テーブル、03の連鎖先のtriggerを追跡。内部FK triggerと独自triggerを区別。event_bits、enabled、function_oidで識別 | tgtypeはROW=1、BEFORE=2、INSERT=4、DELETE=8、UPDATE=16、TRUNCATE=32、INSTEAD=64のbit。tgenabledはO=通常、D=無効、R=replica、A=常時。独自triggerの本文・引数・外部副作用はこのSQLでは未確認。削除失敗や外部通信の可能性を解消するまで保留 |
| 07 → 08 | policy対象role、操作（r/a/w/d/*）、permissive、USING/WITH CHECK有無、実効table/column権限・schema USAGE・role継承。Storage policyも全件対象 | exact_owner=trueは式文字列の一致だけ、mentions_ownerは候補にすぎない。falseは安全/危険の断定不可。PUBLIC policy、複数permissiveのOR、restrictiveのAND、所有者・BYPASSRLS・superuserを含めて評価。追加の広いpolicy、TRUNCATE、column権限、role継承は要調査 |
| 09 → 10 | 全非system関数の候補・OID/type OID・SECURITY DEFINER・EXECUTE・search_path設定有無、relation依存を確認。4テーブル以外も04の全relation/所有らしい列と03のFKから棚卸し | search_pathの存在だけでは安全性未確認。PUBLIC由来EXECUTEは各roleの実効権限に反映。definer、追加RPC、公開view、所有者列なしtableを見落とさない。依存catalogだけでは文字列body/dynamic SQL・間接呼出しを網羅できない |
| S1 → S2またはS3 | 02/04でstorage relation・列・型、07/08でpolicyと権限・全件可視性を確認。bucket設定と所有関係の集計 | S2はowner_id text/varchar、S3はlegacy owner uuid。両列があるなら意味と現行APIの採用列を確認し、必要なら別々に記録。両方なし/型違いは取得不可または未確認。空bucket・未一致所有者・ownerなしも調査し、Auth削除可を推定しない |

policy/制約/trigger/view/functionの任意定義には秘密literalが混入し得るため、`pg_get_functiondef`、prosrc、proconfig全文、trigger引数、CHECK/default全文を出力しない。07は所有者式との一致判定のみで任意policy式を返さない。必要な意味レビューは担当者が管理された環境で秘密を出力しない方法を別途レビューし、安全な要約だけを記録する。SQLだけで完全監査済みとしない。

Storage集計はobjectのpath・名前・所有UUID・metadataを返さず、Auth IDをJOIN比較するだけ。RLS制限下の0件は所有物なしの証明にならない。バケットpublic=trueの公開配信や署名URLは所有者policyと別経路であり、SQLだけでは物理ファイルの消去、既存URL、Auth APIの削除阻害を検証できない。

## 将来のステージング検証計画（今回未実施）

本番からのコピーを使わない隔離環境で、独立した合成A/Bを作る。4テーブルにA/B各複数行、unique制約に適合する人工本文を置き、合成データのID・件数・値の比較用baselineを安全に保存する。A/B用JWTはメモリ等の限定されたfixtureで管理しログ・成果物に残さない。各caseは新しいfixtureで実施し、DB版、Auth/Storage版、採用SDK、migration SHA、API分類、合否を記録する。全件確認可能な担当者とA/Bの通常クライアントを使い分け、service_roleでRLS試験をしない。

| case | 将来の操作 | 合格条件・失敗時判断 |
| --- | --- | --- |
| データ分離 | A/BそれぞれでSELECT/INSERT/UPDATE/DELETEを試す。相手user_idへの書込み・upsert・ID差替えも試す | 相手の行を読めず変更不可。bloomのUPDATE/DELETEとfavoriteのUPDATEは非許可。権限でAPIが0件成功を返す場合もDB baseline比較で確認 |
| 移行前阻害 | 現行NO ACTIONのtodosを持つAでAuth hard deleteを試す | Authと全4テーブルが保持される。部分消失なら停止。これはCASCADE移行後の成功試験と分ける |
| 削除連鎖 | 別途レビュー済みのデータ保持migration適用後に、サーバー限定Auth Admin hard deleteでA削除 | AのAuth・関連session・4テーブル・追加連鎖先が期待どおり消失。BのAuthと全行はID/値まで不変。通常クライアントDELETE許可を増やして合格させない |
| 削除失敗と原子性 | 隔離fixtureだけでDELETE trigger例外やFK阻害を注入し同じAuth APIを実行、終了後にfixture変更を撤去 | A/BのAuthと全4テーブルがbaselineと一致。HTTPエラーだけでrollbackを認定しない。外部副作用は別評価。応答喪失はunknownとして照合し、明確なrollbackと区別 |
| Storage所有物 | Storage APIでA/B各合成object、ownerなしobject、public/private bucketを用意。Aに所有物を残した状態でAuth削除を試す | 現行APIの所有列、削除阻害の有無とAuth/4テーブル/Storageの保持を観測。想定と違って成功しても公開不可、残存物を調査。所有物処理方式決定後、APIによる削除とB不変、物理配信・署名URLを別検証。storage.objectsのSQL削除を物理削除とみなさない |
| 発行済みJWT | 削除前のAの有効JWTを保持。削除直後・有効期限前・refresh・期限後にdashboard、export/Gemini Action、直接PostgRESTの4テーブル/追加table/view、公開RPC、Storage読書きを試す | Aの機密読取り、Bアクセス、AのINSERT/upsert/再書込みが成立しない。FKで再作成拒否、Bの全行不変、refresh不可を確認。空SELECTとHTTP statusだけで全経路遮断としない。新規object作成も調べる。公開bucket/既存署名URLは別の公開・保持条件として明示し未解決なら保留 |

失敗・未確認が残れば機能は公開しない。後始末は合成fixtureだけ、テスト終了時のB不変確認の後に実施する。通常のtestやモック成功でAuth API・FK原子性・Storageの実挙動を代替しない。

## 実装開始前の判定票

- [ ] 本番監査の実行結果と全件可視性根拠を保存し、取得不可・未確認・差異を担当者が解消した。
- [ ] 全FK連鎖、4テーブルの制約/index、追加の所有table/view、policy・role権限、trigger・関数/RPCの意味をレビューした。
- [ ] todos等の必要なCASCADE移行案を別PRで用意し、データ保持・孤児行・ロック/負荷・制約検証を計画した。schema.sqlの再実行を移行にしない。
- [ ] Storage所有物の阻害・物理削除・公開/署名URL・外部副作用の扱いを決めた。
- [ ] ステージングのA/B、成功・失敗・残存JWTの全経路検証を実施する担当者と合格条件を合意した。
- [ ] 操作状態の保存先（Auth CASCADEで消えない永続状態、排他、応答喪失照合、受付票の期限/保持/権限）は**未決**。この監査ではtableや保存方式を決定しない。
- [ ] 再認証方式（特にGoogleの検証可能な証跡、単回性、期限、元ユーザー/セッションとの結合）は**未決**。通常ログイン成功を削除用再認証の確定方式としない。
- [ ] バックアップ・ログ・外部サービスの保持と利用者向け説明を確認した。完全消去を未確認で保証しない。

## この変更の検証

SQLは静的レビュー済み。SELECTのみでDML、DDL、DO、COPY、EXECUTE、ユーザー定義関数呼出し、Auth APIはない。catalog参照と組込みのメタデータ/権限関数、任意のStorage件数集計のみ。SQLを自動実行する設定は追加していない。

この環境にはPostgreSQLサーバー/psqlが見つからず、PostgreSQLでの構文・型解決・版互換性は**未検証**。DBに接続していないため、本番/ステージング監査も**未確認**。将来の担当者は版とcatalog列を照合してから実行する。文書と自動実行されない監査SQLのみの変更なのでAGENTS.mdに従い `npm run test`、`npm run test:coverage`、`npm run lint`、`npm run build`、`npm run e2e` を省略する。Git差分・状態の検証は実施する。
