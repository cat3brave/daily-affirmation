# メールによるパスワード復旧の導入

## フローと保証の範囲

インストール済み `@supabase/ssr 0.10.2` / `@supabase/supabase-js 2.104.0` をそのまま使用する。ブラウザーの `resetPasswordForEmail(email, { redirectTo: origin + '/auth/recovery' })` がPKCE verifierをCookieへ保存する。メールのSupabase確認URLを経由し、`/auth/recovery?code=...` でサーバーSDKの `exchangeCodeForSession()` が交換する。応答へSDKのCookieとキャッシュ禁止ヘッダーを反映し、固定の `/reset-password` へ転送する。任意のnextは読まない。固定パスを相対Location（303）で返し、開発環境のループバック名正規化やリバースプロキシでもブラウザーのoriginを維持する。Hostやforwardedヘッダーから転送先を組み立てない。交換失敗は既存セッションに関わらず固定の `/reset-password/invalid` となる。

依頼フォームはhydration完了まで入力・送信を無効化する。再設定画面ではSDKのSSR Cookie復元に伴う初期SIGNED_INを認証成功とせず、利用者変更の検知に使う。再設定画面は `getUser()` でAuthサーバーへ確認し、更新直前も同じユーザーか確認して `updateUser({ password })` を実行する。空・不一致のみをクライアント検証し、文字列は空白やUnicodeも含め変更しない。既存の新規登録に最低文字数の指定はなく、リポジトリには本番のAuthパスワードポリシーが記録されていない。独自の文字数制約を追加せずサーバーのポリシーを使用する。本番の最小文字数、必要文字種、漏洩パスワード拒否などは公開前に管理者が確認する必要がある。弱いパスワード・既存と同じパスワードなどのSDKエラーを内部情報のない固定案内にする。

`getUser()` は認証済みユーザーの存在を保証するが、通常ログインと復旧で得たセッションを区別する復旧証明ではない。インストール済みSDKのコード交換は `redirectType` を返すことがあるが、これはローカルverifierに付く情報であり、独立したサーバーの復旧証明として使用しない。サーバーでの交換イベントを別のブラウザークライアントの `PASSWORD_RECOVERY` イベントとして受信できるとも仮定しない。通常ログイン済みユーザーが直接 `/reset-password` を開いた場合も、`getUser()` の本人確認後にそのユーザーのパスワードを更新できる。これはSDKの通常の自己パスワード更新機能の範囲であり、「復旧セッションだけを許可する」保証は行わない。URLや独自Cookie、localStorage等の独自復旧証明は追加していない。

更新とログアウトは別処理である。成功後は入力を消し、現在のセッションだけを `signOut({ scope: 'local' })` で終了する。ログアウト失敗時は更新済みと明示し、ログアウトのみを再試行する。他端末を含む全セッションの失効は検証・保証していない。利用者変更、ログアウト、アンマウントを監視し、進行中の古い結果を画面へ反映しない。ただし送信済みSDKリクエストを取り消すものではない。

## ブラウザー・Cookieの成立条件

依頼とリンクを開く操作は同じ端末・同じブラウザー・同じサイトoriginで行い、verifier Cookieを保持する。別ブラウザー、プライベートモードの別コンテキスト、Cookie消去、別ドメイン、別のPKCEログイン・復旧依頼によるverifier上書きでは交換できず、再依頼が必要となる。複数の復旧依頼やGoogleログインを同時に開始しない。SDKの実験的な並行PKCE機能は有効化しない。コードは一度のみ交換でき、公式資料では有効期間は5分。メールリンクの期限設定とは別であり、期限・使用済み・通信失敗はいずれも再依頼へ案内する。

## 本番管理者による設定確認（このPRでは変更しない）

既存文書の本番origin `https://daily-affirmation-lac.vercel.app` を使用する場合、Auth > URL Configuration > Redirect URLs に **`https://daily-affirmation-lac.vercel.app/auth/recovery`** を追加する。Site URLが実際の正規originと一致することを確認する。独自ドメインを使用する場合はそのoriginの `/auth/recovery` を正確に追加する。ワイルドカードや任意の外部転送先を追加しない。開発用は `http://localhost:3000/auth/recovery`、Playwrightは `http://127.0.0.1:3100/auth/recovery`（ローカルモックのみでダッシュボード登録不要）。別のプレビューoriginで実検証する場合はその正確なURLをテストプロジェクトだけへ登録する。

Auth > Email Templates > Reset Password はSupabaseの検証経路を通る **`<a href="{{ .ConfirmationURL }}">パスワードを再設定する</a>`** を使用することを確認する。`ConfirmationURL` はSDKへ渡したredirect_toを反映する。単なる `.SiteURL` / `.RedirectTo` だけのリンクで検証を飛ばしたり、token_hashをアプリが独自検証する別フローへ置き換えたりしない。既存のテンプレートがredirect_toを上書きしていないこと、メール配信サービスのクリック追跡・リンク書換え・事前アクセスが一度限りのリンクに影響しないことを確認する。

カスタムSMTP、送信元ドメイン、SPF/DKIM/DMARC、配信ログ・バウンス、Authのメール送信制限・再送間隔・リンク有効期間・必要ならCAPTCHA等を管理者が確認する。クライアントの連打防止は同じ画面での同時操作を防ぐだけで、サーバーの送信制限の代替ではない。共通の正常応答案内は実際の到着やアカウントの存在を保証しない。

既存のGoogle provider設定、Supabase側Google callback、アプリの `/auth/callback` のRedirect URL、既存の登録確認メール設定を削除・置換しない。既存のcallbackとproxyのログイン転送は維持する。復旧画面はproxyでdashboardへ転送しない。callbackと復旧画面の認証関連応答には `private, no-store` を付ける。CDN等も共有キャッシュを無効化し、コード付きURLをアクセスログ、分析ツール、エラー監視へ収集しないよう確認する（ホスティング側のアクセスログ抑制はこのPRでは未設定）。

## 検証と公開前の別作業

VitestはSDKをモックし、Playwrightはブラウザー用の復旧・更新モックとローカルHTTPサーバーによるPKCE交換を使用する。verifierとchallengeの対応、Cookie伝達、固定転送、再設定UI、localログアウトを検証する。これはメール配送、実Supabaseの期限・一回限り制約、実際のパスワードポリシー、SMTP、全端末の失効を確認するものではない。実Supabaseや実メールへ通信しない。新しいブラウザーテストでは外部通信を拒否し、サーバーではテスト専用fetchプリロードがローカルモック以外へのSupabase通信を検出するとプロセスを失敗させる。本番コードにテスト用の認証分岐はない。本番用スモークもローカルSupabaseモックを使用する。

公開前に別途承認したテストプロジェクト・テスト用アカウントで以下を実施し記録する。

1. 正規Redirect URLと上記テンプレート、SMTP、送信制限、パスワードポリシーを管理者が確認する。
2. 同じブラウザーから復旧を依頼し、実メールのリンクで再設定画面に戻れることを確認する。コードやリンクは記録へ貼らない。
3. 期限切れ・使用済み・別ブラウザー・Cookie消去・PKCEの上書きで安全に失敗し、再依頼できることを確認する。
4. 弱いパスワード拒否、確認不一致、空白を含むパスワードなどをテストする。更新成功・現在セッションのログアウト・新パスワードでのログイン・旧パスワードの拒否を確認する。
5. Google認証、メールログイン、新規登録と登録確認メールを回帰確認する。認証応答の共有キャッシュ禁止も確認する。

上記の実メール・実Supabase検証、本番設定変更、実ユーザーの変更、マージはこのタスクでは実施しない。

## 参照資料

実装前に[公式パスワード認証](https://supabase.com/docs/guides/auth/passwords)、[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)、[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)、[SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)、[resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)、[exchangeCodeForSession](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession)を確認。changelog.mdは取得ツールのContent-Type制約で読めなかったため、[公式Changelog](https://supabase.com/changelog)を確認。TLS 1.2旧暗号の廃止予告は現行ブラウザー・Nodeを前提とするこの実装のAPI変更を必要としない。将来版の実験的APIは取り込まない。

## 変更範囲の自己レビュー

- proxyは復旧画面へ共有キャッシュ禁止ヘッダーを付けるために対象を追加した。dashboardの本人確認・保護・ログイン時の転送条件は変更していない。復旧callbackはproxyの対象外で、ハンドラー自身がPKCE交換を検証する。
- Playwright設定と本番E2E実行スクリプトの追加は、ローカルモック以外へAuth SDKが誤通信した場合に失敗させるテスト専用プリロードだけである。本番アプリの分岐や既存スモークテストの差し替えはない。本番E2Eの環境変数の許可リストも維持する。
- 既存モックの通常のログイン・Google用コード交換の応答は維持した。復旧用のブラウザーモック、challengeとverifierを照合するサーバーモック、開発E2E用の監査参照を追加した。監査にはパスワードやリクエスト本文を記録しない。
- 既存のdashboard認証テストでは、繰り返し行うボタン検索がCPUプロファイルの約33%（その内部のスタイル計算が約31%）を占めた。操作対象を表示テキストで絞り、選択したボタンのrole・アクセシブル名・可視性を明示的に検証する補助関数へ変更した。既存assertion、テスト件数、5秒制限、coverageの対象・閾値、CIの制限時間は維持した。
- 復旧callbackテストはstubした環境変数を毎回復元し、再設定画面テストは各ケースのアンマウント後にAuth購読が解除されることも確認する。

前回の一時ログは再開した環境には残っていないため、前回300秒時点の最後の完了ファイルや未完了処理は確定できない。再開後の詳細ログでは修正前でも全53ファイル・524件の処理が263.65秒で完了し、失敗は既存の花壇ロック検証1件の5秒超過だった。新規復旧処理の未解決待ちや購読漏れが全体を停止させた証拠はなく、今回確認できた問題は繰り返すDOM検索の処理コストである。

追加のブラウザー検証で、遷移前後のメール欄が同じラベルを持つことによるテストの入力先競合と、Nextの自動ルート通知もalertロールを持つことを確認した。復旧ページのURL・見出しを待ってから入力し、エラー案内はmain内で検証する。callbackのキャッシュヘッダーは転送後のページではなくcallback応答自体を検証し、本番E2Eでも復旧画面のキャッシュ禁止を確認する。

## 最終ローカル検証記録

再開時のnode_modulesではNext.jsだけが16.3.6で、既存lockfileの16.3.8と不一致だった。書き込み可能な一時npmキャッシュを指定して `npm ci` を実施し、lockfileに合わせた。依存定義・lockfileは変更していない。初回ブラウザー終了遅延の単一の原因と、前回300秒超過時の詳細は未確定だが、最終的には標準の1ワーカーで全件成功した。2ワーカーの診断では既存テストが時間を超過したため、CIの1ワーカー設定は維持している。

- 原因に関係するVitestを対象実行し、修正後の復旧関連46件も成功した。
- `timeout 300s npm run test:coverage -- --reporter=verbose`：53ファイル・526件成功、162.62秒。Statements 92.75%、Branches 87.11%、Functions 96.31%、Lines 95.81%。600秒への延長は使用していない。
- `timeout 300s npm run lint`：警告・エラーなし。
- `timeout 600s npm run e2e`：標準1ワーカーで73件成功（コマンド全体約8分12秒）。
- `timeout 600s npm run e2e:prod`：Next.js 16.3.8の本番build・TypeScript確認と4件のスモーク成功（全体約2分8秒）。
- 通常testはcoverageと同じ対象なので重複実行を省略。単独buildは本番E2Eで成功したため省略。

公式Chromium配布先は403だったが、環境に既存のDebian Chromium 151.0.7922.173を一時ブラウザー保存先から利用できた。リポジトリのブラウザー設定は変更していない。GitHub CIではPlaywrightが指定するブラウザーで別途確認する。ローカル検証でChromium不足の例外によるE2E省略は行っていない。実メール・実Supabase・本番設定の確認は前述の公開前手順として残る。
