import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-50 p-6 text-sky-700">
      <section className="w-full max-w-md rounded-[2rem] border border-sky-100 bg-white/90 p-8 text-center shadow-sm">
        <h1 className="mb-3 text-2xl font-bold text-sky-700">
          ページが見つかりませんでした
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-sky-600/80">
          URLをご確認いただくか、最初の画面へお戻りください。
        </p>
        <Link
          href="/"
          className="inline-flex w-full justify-center rounded-full bg-sky-400 px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2"
        >
          最初の画面へ戻る
        </Link>
      </section>
    </main>
  );
}
