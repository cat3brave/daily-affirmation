import Link from "next/link";

export const metadata = { title: "プライバシーとデータ | Daily Affirmation" };

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-[2rem] bg-white p-5 text-slate-700 shadow-sm sm:p-10">
        <p className="mb-2 text-sm font-bold text-sky-700">Daily Affirmation</p>
        <h1 className="text-2xl font-bold text-sky-900 sm:text-3xl">
          プライバシーとデータ
        </h1>
        <p className="mt-4 leading-7">
          ここでは、現在のアプリ実装で確認できるデータの流れと、利用できる操作を説明します。
        </p>

        <section className="mt-8" aria-labelledby="supabase-data">
          <h2 id="supabase-data" className="text-xl font-bold text-sky-900">Supabaseへ保存するデータ</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
            <li>ToDoの本文、完了状態、作成日時</li>
            <li>お気に入りにしたアファメーションと作成日時</li>
            <li>「3つのよかったこと」の日付、3つの文章、作成日時</li>
            <li>咲かせた花の種類と作成日時</li>
            <li>プロフィールに保存されている花の累計</li>
          </ul>
          <p className="mt-3 leading-7">各データは認証されたユーザーIDに結び付けて保存・表示・削除します。</p>
        </section>

        <section className="mt-8" aria-labelledby="browser-data">
          <h2 id="browser-data" className="text-xl font-bold text-sky-900">このブラウザーに保存するデータ</h2>
          <p className="mt-3 leading-7">
            localStorageへ、ユーザー別のお気に入り表示用キャッシュと「3つのよかったこと」の未保存の下書きを保存します。
            ログアウトが成功した後は、現在のユーザーのこの端末内データだけを消去し、別ユーザーのデータは消去しません。
          </p>
        </section>

        <section className="mt-8" aria-labelledby="ai-data">
          <h2 id="ai-data" className="text-xl font-bold text-sky-900">Google Gemini APIへ送る内容</h2>
          <p className="mt-3 leading-7">
            アファメーション生成にGemini APIを使用します。「優しい翻訳機」では、入力した文章を翻訳のためGemini APIへ送信します。
            個人情報、連絡先、医療情報などの機微な情報は翻訳欄へ入力しないでください。
          </p>
        </section>

        <section className="mt-8" aria-labelledby="controls">
          <h2 id="controls" className="text-xl font-bold text-sky-900">現在利用できる操作</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
            <li>ダッシュボードで、保存したお気に入り・よかったこと・花の記録を表示できます。</li>
            <li>画面に削除操作があるお気に入りと「3つのよかったこと」は削除できます。</li>
            <li>ログアウトすると、成功後に現在のユーザーのlocalStorageデータを消去します。</li>
            <li>ログイン中は、Supabaseへ保存した本人のデータをJSONでエクスポートできます。端末内のキャッシュと下書きは含みません。</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="account-delete">
          <h2 id="account-delete" className="text-xl font-bold text-sky-900">アカウント削除</h2>
          <p className="mt-3 leading-7">安全性の検証が完了するまで削除機能は準備中です。利用可能になった場合は、本人確認と最終確認を経て削除します。</p>
          <Link href="/account/delete" className="inline-block py-3 font-bold text-sky-800 underline">アカウント削除の案内</Link>
        </section>

        <nav aria-label="アプリ画面" className="mt-10 flex flex-wrap gap-3 border-t border-sky-100 pt-6">
          <Link href="/login" className="rounded-full bg-pink-700 px-5 py-3 font-bold text-white">ログイン画面へ</Link>
          <Link href="/dashboard" className="rounded-full border border-sky-300 bg-white px-5 py-3 font-bold text-sky-800">ダッシュボードへ</Link>
        </nav>
      </article>
    </main>
  );
}
