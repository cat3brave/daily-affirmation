# アカウント削除の現状調査・実装設計

調査日: 2026-10-02。調査基準: 最新 `origin/main` の `4cc6b190a5196a0317e8937fc6396bd9e5dcd2b6`（PR #48）。開始時の作業ツリーに差分なし。作業ブランチ: `codex/design-account-deletion`。

この文書はPR #49時点の未実装の設計案です。PR #49では文書だけを変更し、アプリコード、SQL、RLS、依存関係、環境変数、本番設定を変更しません。実アカウントや実データの削除、秘密情報の取得、本番DBへの接続は行っていません。

## 1. 現状と削除範囲

### 認証・データアクセス

- `app/login/page.tsx`: メール・パスワードの登録／ログインとGoogle OAuthログイン。
- `app/auth/callback/route.ts`: OAuthコードを `exchangeCodeForSession()` で交換し、通常のログイン先へ移動。削除用の再認証フローはありません。
- `app/lib/supabaseServer.ts`: 公開URL・anon keyでSSRクライアントを作り、`getAuthenticatedUser()` がAuthサーバーへの `getUser()` の結果からIDを返します。設定不足・認証エラーでは本人情報を返しません。
- `proxy.ts` と `app/dashboard/page.tsx`: `getUser()` で保護画面を判定。`app/actions.ts` のGemini処理と `app/exportDataAction.ts` も本人確認を行います。
- `app/lib/supabaseClient.ts` と各hook／component: ブラウザーからSupabaseのテーブルを直接読み書きします。画面やServer Actionだけの保護では、この直接アクセスを代替できません。
- 現在、アカウント削除API、管理用Supabaseクライアント、削除用再認証・操作状態の保存先はありません。

### リポジトリのテーブル・外部キー・削除連鎖

根拠は `supabase/schema.sql`。以下はリポジトリの定義であり、本番DBの実状態を示すものではありません。各テーブルの主キーは `id uuid` です。

| テーブル | 削除対象のユーザー所有データ | 外部キー | 定義上の削除動作 | RLSの許可操作 |
| --- | --- | --- | --- | --- |
| `public.todos` | 本文、完了状態、作成日時 | `user_id → auth.users`（参照列省略、主キー `id` を参照）。NOT NULL、既定値 `auth.uid()` | **ON DELETE CASCADEなし**。既定のNO ACTIONで、参照行があれば親の削除を阻止 | SELECT／INSERT／UPDATE／DELETE。`auth.uid() = user_id`、INSERTはWITH CHECK。TO指定なし |
| `public.bloom_logs` | 花の種類、作成日時 | `user_id → auth.users(id)`、NOT NULL | ON DELETE CASCADE | authenticatedのSELECT／INSERTのみ。DELETE・UPDATEポリシーなし |
| `public.three_good_things` | 日付、3つの文章、作成日時 | `user_id → auth.users(id)`、NOT NULL | ON DELETE CASCADE | authenticatedのSELECT／INSERT／UPDATE／DELETE。UPDATEにもWITH CHECK |
| `public.favorite_affirmations` | お気に入りの言葉、作成日時 | `user_id → auth.users(id)`、NOT NULL | ON DELETE CASCADE | authenticatedのSELECT／INSERT／DELETE。UPDATEポリシーなし |

全4テーブルでRLS有効化と所有者条件が定義されています。`todos` のUPDATEはUSINGのみで、WITH CHECK省略時はUSINGが新しい行にも適用されます。CASCADEによる参照整合性処理は通常のクライアントDELETEポリシーとは別であり、`bloom_logs` にDELETEポリシーを追加することは推奨方式のためには不要です。[RLS公式資料](https://supabase.com/docs/guides/database/postgres/row-level-security)

`three_good_things` は `(user_id, date)`、`favorite_affirmations` は `(user_id, text)` が一意です。テーブル相互の外部キーはこのSQLにありません。

Auth側は本人の `auth.users` と関連するidentity・session等が削除対象です。Auth管理スキーマはリポジトリで定義していません。公式資料ではhard deleteによる `auth.users → auth.sessions` の連鎖とrefresh tokenの無効化が説明されていますが、その他のAuth内部テーブルの制約一覧は本番未確認です。内部テーブルの手動削除は計画しません。[ユーザー管理公式資料](https://supabase.com/docs/guides/auth/managing-user-data)

### 本番未確認事項

具体的な読み取り専用SQL・実行順・期待結果・取得不可と未確認の区別は[DB監査手順](account-deletion-db-audit.md)を参照してください。監査準備ではDBに接続せず、FK/RLS変更や削除API実行を行いません。操作状態保存先と再認証方式は引き続き未決です。

- `create table if not exists` は既存テーブルの外部キーを変更しません。SQLを再実行しても既存DBがこの定義に一致するとは限りません。
- `docs/supabase-schema.md` は構成メモで、一部にDROP TABLE例があります。既存データを保持する移行の実行手順として使用しません。
- 実装前に、権限のある担当者が読み取り専用で `pg_constraint`／`pg_get_constraintdef`、`pg_policies`、RLSフラグ、テーブル権限、トリガーを確認します。`auth.users` と4テーブルへの全参照（追加テーブル・別スキーマを含む）、制約の検証状態・遅延設定、Auth関連の連鎖も棚卸しします。
- Supabase Storage呼び出しはアプリの調査範囲で見つかりませんが、本番に所有オブジェクトがないことは未確認です。公式資料ではStorage所有オブジェクトがあるとAuthユーザーを削除できません。存在する場合は外部ストレージとの原子性を別設計し、解決するまで機能を公開しません。
- バックアップ、ログ、外部サービスの保存・削除条件は未確認です。保持期間や完全消去保証を利用者に約束しません。

### ブラウザー・外部データ

| 保存先 | 現状 | 削除時の扱い |
| --- | --- | --- |
| localStorage `favoriteAffirmations:<userId>` | お気に入り表示用キャッシュ | 成功後に本人のキーだけ削除 |
| localStorage `daily-affirmation:three-good-things-draft:<encodeURIComponent(userId)>` | 日付と3つの未保存文章 | 成功後に本人のキーだけ削除。エクスポートには含まれない旨を先に案内 |
| Supabase SSRの認証Cookie・セッション | `@supabase/ssr` を使用。公式の既定はPKCE・Cookie保存 | SDKによるセッション後始末とサーバー側Cookie消去。実際の保存キーを実装時に確認 |
| Reactの画面内状態 | 翻訳文、生成文、雲などの一時状態 | 成功後に読み書きを停止して破棄。保存処理によるlocalStorage再作成も防止 |
| ダウンロード済みJSON | 利用者のファイルとして保存 | アプリから回収・削除できない。利用者が管理 |
| Google／Gemini | Googleはログイン、Geminiへは翻訳入力等を送信 | Googleアカウント自体は削除しない。外部サービス側のデータ消去は本機能の保証に含めない |

根拠: `app/lib/userLocalStorage.ts`、`app/lib/threeGoodThingsDraft.ts`、`app/hooks/useFavoriteAffirmations.ts`、`app/components/LogoutButton.tsx`、`app/privacy/page.tsx`、`app/actions.ts`。`removeUserLocalData()` は現在ユーザーの2キーを個別に消去し、片方の失敗でも後続処理を続けます。`localStorage.clear()` は使用しません。他端末のlocalStorageは遠隔消去できません。同一originの別タブは削除通知・認証状態の再確認で本人の状態を破棄します。

### JSONエクスポート

`exportUserData()` はクライアント指定IDを受け取らず、検証した本人IDで4テーブルを絞り、RLS下で1000行ずつ取得します。`schemaVersion: 1`、UTCの `exportedAt`、`todos`／`favoriteAffirmations`／`threeGoodThings`／`bloomLogs` を含みます。認証情報や `user_id`、localStorageの下書き・キャッシュは含みません。

`DataExportButton` はJSONのダウンロードを行い、PR #48以降のファイル名は端末の現地日付です。並行更新中のページ取得は厳密なスナップショットではありません。インポート機能もありません。削除案内では未保存下書きの保存・別途控えを促し、書き出し結果を利用者自身が確認できる時間を設けます。

## 2. 推奨削除方式と代替方式

**推奨: 全ユーザー所有テーブルの外部キーを確認・CASCADEへ移行し、サーバー限定の管理クライアントから `auth.admin.deleteUser(verifiedUserId, false)` を呼ぶhard delete。** 子テーブルを先に個別削除しません。Auth親行とCASCADE対象のアプリ行を同一DBトランザクションの削除連鎖で消す構成にします。

| 方式 | 途中失敗・運用 | 判断 |
| --- | --- | --- |
| Auth Admin hard delete＋CASCADE | FK／トリガーエラー時は同一DBトランザクション全体のロールバックを期待できる。HTTP応答喪失は結果不明になる。外部Storage等は別問題 | 推奨。ステージングでAuth APIを含む原子性を検証することが公開条件 |
| 子テーブルのDELETEを順次実行してからAuth削除 | 各API呼び出しが別トランザクション。Auth削除失敗時にアカウントだけ残り、データが失われる。クライアントRLSでは花ログのDELETEも許可されない | 採用しない |
| 限定権限のDB関数で親子削除を一括実行 | 単一トランザクション化できるが、Auth内部への直接操作・SECURITY DEFINER権限・検索パス・実行権限の安全性を維持する必要がある | 代替。管理APIより保守負荷が高く、Auth内部SQLを安易に実装しない |
| soft delete／非同期削除ジョブ | 操作状態・再試行を管理しやすいが、アクセス遮断と最終削除の仕組みが必要。soft deleteは復元機能ではなく、hard deleteの連鎖と同じとは扱えない | 外部データが増えた場合に再検討。今回の第一案にしない |

FK削除連鎖の原子性はDB内に限られます。公式ドキュメントの記述だけで、当該プロジェクトのAuth API・独自トリガーを含む全挙動が検証済みとはしません。ステージングで途中に例外を発生させ、Auth行と全4テーブルの行がすべて保持されることを確認します。外部通信するトリガー等がある場合、その副作用はDBロールバックだけでは戻せません。

### 必要なDB変更と既存データを保持する移行

1. 実DBの制約名と定義を取得し、他ユーザーを含む行数・主キー・所有者対応と孤児行の有無を確認する。孤児行があれば自動削除せず移行を停止する。
2. 将来の専用migrationで `todos.user_id → auth.users(id) ON DELETE CASCADE` に変更する。DROP TABLE／TRUNCATE／テーブル再作成はしない。
3. 既存FKの取り外しと新FK追加は同一トランザクションで行い、必要なロック・タイムアウトを計画する。大規模ならNOT VALIDで追加後、別途VALIDATEする段階移行を検討する。削除機能は検証済み制約になるまで無効にする。
4. 他の3テーブルも実定義を照合し、相違がある場合だけ修正する。SQLの新規構築定義とmigrationを揃える。`todos.user_id` の索引有無・削除時の負荷を評価する（他2テーブルにはuser_id先頭の一意索引あり）。
5. 移行前後で行数・ID・本文等が不変、他ユーザーの行が不変、FK・RLS・権限が意図どおりであることを検証する。取り消し用DDLも用意するが、移行後に実行したアカウント削除はDDLを戻しても復元できない。
6. 再認証証跡と削除操作状態用のサーバー専用保存先を設計する。後述の操作状態はAuth削除のCASCADEで消えない構造が必要。保存項目・アクセス権・運用上の保持方針を実装前に決める。

この文書には実行用SQLを含めず、今回は上記変更を行いません。

### 重複・再試行・応答喪失

- UIのdisabledと同期的なin-flightガードに加え、サーバーでユーザー単位の永続的排他と一意な操作IDを使う。プロセス内のMapだけでは複数インスタンスを防げない。
- 操作IDはサーバーが発行して検証済み本人IDに結び付け、状態を `prepared / processing / failed / unknown / succeeded` として管理する。クライアントのuserIdや操作IDだけで対象を決めない。
- 再認証・最終確認後に操作を開始し、同じ操作の重複には既存状態を返す。Auth削除と操作状態の記録は別トランザクションになり得るため、操作を事前永続化してから実行し、処理中のまま残った操作を照合できるようにする。
- 明確なロールバックを確認した失敗だけ再試行可能にする。タイムアウト、接続切断、削除成功後の状態更新失敗は `unknown` とし、「何も削除されていない」と表示しない。
- サーバーが保存済みの対象IDを管理APIで照合し、Auth不在と対象アプリ行不在を確認した場合は成功に収束させる。単なる404、`getUser()` の失敗、未認証を一律に削除成功にしない。サービス障害と不在を区別する。
- 削除後は `getUser()` が通らないため、通常の削除再実行を許可しない。事前に本人確認済みの操作に限り、短時間のランダムな操作受付票（サーバーにはハッシュ、ブラウザーにはHttpOnly／Secure／SameSite Cookie）で状態照会だけを許可する。対象ID指定・新しい削除・個人データ参照には使用できない。受付票の有効期間、失効・保存先を実装前に決定する。
- 受付票が失われた場合は勝手に成功扱いせず、ログイン画面で結果不明を案内し、最小限の操作番号で運用照合できるようにする。再ログインで新規アカウントが生成された場合も旧操作と紐付けない。

## 3. 認証・権限

### サーバーの境界

- 削除を行うServer ActionまたはPOST Route Handlerで、毎回 `getUser()` により本人を検証する。Cookieの生のsession、`getSession()` のuser、フォーム・URLのID、メールアドレス、localStorageを信用しない。対象は検証した `user.id` とサーバー記録の一致した1人だけ。
- 同一origin検証・CSRF対策を実装し、GETアクセスで削除しない。Route Handlerを採用する場合もNext.jsの画面側制御だけに依存しない。
- 管理キーは例として `SUPABASE_SERVICE_ROLE_KEY` 等のサーバー専用設定で保持し、`NEXT_PUBLIC_` を付けない。secret key利用可否は採用SDK・プロジェクトで確認する。取得・設定は将来の承認済み実装作業で行う。
- 管理クライアントは `server-only` のモジュールからリクエストごとに作り、session保存・自動refreshを無効にする。SSRユーザークライアントと分離し、ユーザーCookieで管理認証を上書きしない。特権キーはRLSを回避するため、本人限定のサーバー認可が必須。
- URL・管理キー・操作保存先・再認証検証が未設定なら、削除機能を利用不可として安全に停止する。anon keyへの代替、部分削除、クライアントでの管理API実行は行わない。
- 成否レスポンス・例外・ログに鍵、Cookie、JWT、パスワード、OAuthコード、本文を含めない。操作番号と安全なエラー分類のみで調査する。

### 再認証

本人確認済みの既存セッションだけでは最終削除を許可せず、削除用の再認証を必須にします。サーバーで短時間・単回の証跡を保持し、本人ID・現在セッション・削除操作に結び付けます。有効期間は実装前に決定し、最終POSTで検証します。JWTのrefresh時刻やクライアントの「再認証済み」フラグは証跡になりません。

- メール・パスワード: 元の検証済みユーザーのメールをサーバーで取得し、専用の再ログインでパスワードを検証。返されたIDが元IDと一致したときだけ証跡を作る。パスワードを保存・ログ出力しない。
- Google OAuth: 削除用のサーバー発行challengeとPKCEフローを用意し、callbackでコード交換・`getUser()`・元ID一致・challenge期限を確認する。通常callbackの成功だけで削除へ進めず、確認画面に戻す。別Googleアカウント選択、キャンセル、callback再利用は拒否する。
- Googleの既存ログイン状態による自動通過、アカウント選択やconsent画面だけで「パスワードを再入力した」とみなさない。プロバイダー側の再認証強制とサーバーで検証可能な証跡の方式をステージングで確認し、成立しなければ別の本人確認方式を設計するまでGoogle利用者の削除を有効にしない。不要なGoogle offline token権限を追加しない。
- Supabase `reauthenticate()` は公式上、パスワード更新のnonce送信に使うAPIです。これを呼んだだけでAdmin削除が再認証必須になるわけではありません。削除の認可証跡として無条件に流用しません。

### 既存セッション・削除後アクセス

公式資料によると、Authユーザー削除は発行済みJWTを即座には無効化しません。hard deleteでrefresh tokenからの新規発行は止まりますが、既存access tokenは期限まで利用され得ます。`signOut()` も発行済みJWTの即時失効保証にはなりません。

- 保護画面・エクスポート・Gemini・その他サーバー処理は既存の `getUser()` チェックを継続する。削除済みIDの既存Cookie、古い画面、ブラウザーの戻る操作でも保護データを返さない。
- 4テーブルは本人行が消え、FKにより同じ削除済みIDでのINSERTが拒否されることを実DBテストで確認する。他人の行にはRLSを維持する。
- それでも残存JWTで直接APIを呼べるため、本番の全公開テーブル・ビュー・RPC・Storageを棚卸しする。必要なアクセス経路に限って、限定権限のサーバー／DB関数で `session_id` がAuth sessionに存在することを検証する方式を設計する。Authスキーマ全体のSELECT権限をブラウザーに与えない。機密経路を閉じられなければ公開しない。
- 現在の `useAuthUser(initialUser)` は初期ユーザーがあると再取得しないため、削除通知・タブ再表示・認証イベントで状態を破棄する対応が必要。DBの保護をこのイベントに依存させない。
- 削除完了後はクライアント・サーバー両方でセッション後始末を行う。削除済みゆえのsignOut失敗をアカウント削除失敗と混同せず、本人localStorage消去とログインへの移動を続ける。
- 同じGoogleアカウント等で再登録した場合は新規アカウントとして扱い、旧データを復元しない。自動新規登録の挙動・表示文言は実装前に確認する。

## 4. 利用者の操作フロー

1. ダッシュボードの「プライバシーとデータ」周辺から「アカウントを削除する」へ進む。既存の穏やかなUIに合わせ、通常のログアウトと区別する。
2. 確認画面に「アカウントと、保存済みのToDo・お気に入りの言葉・3つのよかったこと・花の記録を削除します。この操作は取り消せません。このブラウザーのあなたのキャッシュと未保存下書きも消去します」と明示する。Googleアカウント自体、ダウンロード済みJSON、他端末の保存物は消去対象に含めない。
3. 「削除前にJSONを書き出す」を提示する。未保存下書きは含まれないこと、JSONを読み込んで復元する機能はないことを案内する。エクスポート失敗時はエラーと再試行を出し、自動で削除に進めない。利用者が保存不要と明示した場合だけ書き出しを省略できる。
4. 削除専用の再認証後に確認画面へ戻り、対象アカウントと削除範囲を再表示。明示的な確認チェックと「アカウントとデータを削除する」で最終POSTを送る。再認証やOAuth callbackだけで削除しない。

| 状態 | 動作 |
| --- | --- |
| キャンセル | POST前ならデータ・localStorageを変更せず閉じる。再認証証跡を破棄し、起点にフォーカスを戻す |
| 処理中 | 削除・エクスポート・競合する保存操作を止め、二重送信を防ぐ。進行状況を読み上げる。送信後の画面閉鎖は削除を取り消さないと案内し、キャンセル成功と誤表示しない |
| 認証切れ／再認証失敗 | 削除しない。再ログイン／再認証を案内。失敗時に本人localStorageを消去しない |
| 明確な削除失敗 | 汎用エラーと再試行・キャンセルを表示。データ保持が検証された場合のみ保持を案内。必要なら再認証からやり直す |
| 結果不明 | 操作受付票で結果を照合。「削除できませんでした」と断定せず結果確認中と表示。照合不能なら安全な操作番号で案内 |
| 成功 | 保存処理・キャッシュ更新を停止し、削除前に検証済みだった本人IDの2キーを消去。認証Cookie等を後始末して `router.replace('/login')` とrefresh。ログイン画面で完了を読み上げ、見出しへフォーカスする |

localStorage削除がブラウザー制限で失敗した場合、DB成功を取り消さず「このブラウザーの保存データを消去できませんでした」と案内します。現在のhelperは例外を握り潰すため、失敗を識別できる戻り値の追加を将来の実装に含めます。他ユーザーのキーは消しません。

確認UIはラベル・説明を持つdialogまたは専用ページとし、初期フォーカスは安全なキャンセル操作へ。複数ボタンがあるため、既存 `TadaModal` の単一ボタン用Tab処理をそのまま流用しません。Tab／Shift+Tab、送信前のEscape、背景フォーカス抑制、失敗時のエラーへのフォーカス、閉じる際のフォーカス復帰を実装します。

## 5. 実装・テスト計画とPR分割

各PRで必要な通常テスト・lint・build・E2EとDB検証を行います。本番データの削除テストは行わず、独立したローカル／ステージングの合成ユーザーA・Bを使います。

| PR | 作業 | 完了条件 |
| --- | --- | --- |
| 0: DB監査準備 | 読み取り専用監査SQL、実行手順、将来のステージング検証計画 | リポジトリで確認済みと実DB未確認を区別。DB変更・接続・削除実行なし |
| 1: DB移行と削除前提 | 実DB棚卸し、todosのCASCADE移行、新規schema定義整合、必要な操作状態保存先と権限、移行手順 | 既存全データを保持した移行が検証済み。全参照・Storageの阻害要因が判明。制約検証済み。失敗を注入した親削除で全行がロールバックし、Bが不変 |
| 2: 本人確認とサーバー削除 | server-only管理クライアント、再認証challenge、本人ID照合、CSRF、永続排他、状態照会と応答喪失の回復 | 未認証・設定不足では削除APIを呼ばない。別ID入力・別OAuthアカウント・期限切れ証跡を拒否。重複処理・サーバー再起動・Auth成功後の記録失敗が安全に収束。機能は公開前提確認まで無効 |
| 3: 確認UI・後始末 | JSON案内、確認・キャンセル・処理中・失敗・成功、本人キー消去、Cookie後始末、他タブ対応、プライバシー説明 | キーボード・フォーカス・読み上げ・モバイル検証合格。下書き注意が見える。BのlocalStorageが保持され、成功後Aのキーが再生成されない。結果不明を成功／失敗と断定しない |
| 4: 統合検証と公開準備 | 残存JWTによる全アクセス経路の検証、必要最小限のアクセス制御、設定手順・運用照合手順・公開チェックリスト | 下記テスト合格。Storage・Auth APIの原子性・Google再認証の未確認事項解消。管理設定がサーバー限定。機密経路が遮断され、Verify成功後に公開可否を判断 |

### テストの具体例

- **所有者分離**: A・B双方に4テーブルの行を作り、Aを削除するとAのAuthと全所有行だけが消える。BのAuth・行・本文が完全に保持される。悪意あるID・メール・操作番号差し替えでもBの削除APIが呼ばれない。
- **DB移行**: 移行前後のデータ一致、CASCADEと追加参照、孤児行検出、負荷とロック、トリガー例外による全体ロールバック。モックだけで原子性の合格判定をしない。
- **認証**: 未認証、偽造Cookie、期限切れaccess token、refresh不能、Auth障害、再認証前・期限切れ・使い回し、Google別アカウント・キャンセル・コード交換失敗。どれも削除不可であること。
- **連打と回復**: 同一タブ連打、別タブ同時送信、複数サーバー、途中の再起動、削除前の例外、FK失敗、HTTPタイムアウト、成功応答喪失、状態更新失敗、既に削除済みの操作再照会。操作IDはA／B間で共有不可。
- **秘密非露出**: モック用の識別文字列を使い、HTML・クライアントbundle・ネットワーク応答・ログに特権キー、JWT、パスワード、OAuthコードがないこと。設定なしでfail closed。実秘密をテスト取得しない。
- **エクスポート**: 削除前に4種類の本人データを書き出せる。大件数・失敗・セッション切れ、下書き非包含、並行更新の限界、現地日付ファイル名を維持。書き出し後の明示確認まで削除しない。
- **ブラウザー後始末**: 成功時だけAの2キーとセッションを後始末。キャンセル／明確な失敗で保持。片方のremoveItem例外やsignOut失敗でもログインへ移動し、制限を案内。Bのキー・無関係なキーが不変。
- **アクセス遮断**: 削除前に取得したJWT・Cookieを別端末で保持し、削除後にdashboard、Server Action、直接PostgREST、RPC、Storageへアクセス。Aの読取り・再作成・Bへのアクセスが拒否されること。JWTの期限だけに依存した合格判定をしない。
- **アクセシビリティ**: Tab／Shift+Tab／Enter／Space／Escape、フォーカス開始・復帰・失敗・成功、処理中の読み上げ、背景操作抑制、フォーカス可視化。320×720と1280×720、拡大表示で説明・ボタンが隠れず横スクロール不要。axeと手動キーボード確認を併用。

## 6. 実装前に解消する確認・設定

- 本番の全FK・RLS・権限・トリガー・Storage所有物を担当者が確認し、データ保持migrationをレビューする。
- 対象プロジェクトのAuth API hard delete・CASCADE・失敗時原子性・既存JWTの経路をステージングで確認する。
- 管理キーと操作保存先をサーバー限定で用意し、未設定時に機能が停止することを確認する。今回はキー取得も設定も行わない。
- Googleを含む再認証の検証可能な方式、証跡と受付票の期限、排他・状態保存と照合の運用を決める。
- 削除対象外の保存物・ログ・外部サービスの説明を確認する。未確認の保持期間、バックアップからの完全消去、全端末の即時消去は表示しない。

## 7. Supabase公式資料

2026-10-02に公式GitHubの原文を確認しました。公式サイトは実行環境からHTTP 403になったため、サイト本文を直接取得できたとは扱いません。以下に公開URLと確認した原文を併記します。原文のmasterは更新され得るため、実装時には採用SDKとプロジェクトの実挙動を再確認してください。

| 公開URL | 確認した公式原文 | 確認事項 |
| --- | --- | --- |
| [User Management](https://supabase.com/docs/guides/auth/managing-user-data) | [managing-user-data.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/managing-user-data.mdx) | FKのCASCADE推奨、Storage所有物の削除阻害、hard delete・sessions・残存JWT |
| [Admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) | [GoTrueAdminApi.ts のAPI文書コメント](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts) | サーバー限定・service_role、soft delete既定false、soft deleteも不可逆 |
| [getUser](https://supabase.com/docs/reference/javascript/auth-getuser) | [GoTrueClient.ts のAPI文書コメントと実装](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | Authサーバーにユーザー照会 |
| [reauthenticate](https://supabase.com/docs/reference/javascript/auth-reauthentication) | [GoTrueClient.ts のAPI文書コメント](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | パスワード変更用nonceと削除認可の違い |
| [User sessions](https://supabase.com/docs/guides/auth/sessions) | [sessions.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/sessions.mdx) | JWT寿命、session_idでの存在確認 |
| [Advanced SSR guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) | [advanced-guide.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/server-side/advanced-guide.mdx) | SSRのCookie・PKCE、getUserによるセッション確認 |
| [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google) | [auth-google.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-google.mdx) | OAuth／PKCE、GoogleとSupabaseのtokenの区別 |
| [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) | [row-level-security.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx) | 所有者条件、権限とRLS、service_roleの回避、UPDATEのWITH CHECK省略 |

## 8. PR #49の検証方針

文書だけの変更で実行コード・設定に影響しないため、AGENTS.mdと依頼に従いtest・coverage・lint・build・E2Eを省略します。`git diff --check`、`git diff --stat`、`git diff --name-only`、`git status -sb`、`git status --short` で差分と対象ファイルを確認し、対象文書だけをcommitします。
