import type { ReactNode } from "react";

export const recoveryInputClass = "w-full min-w-0 rounded-xl border border-pink-100 p-3 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:opacity-60";
export const recoveryButtonClass = "w-full rounded-full bg-pink-700 px-4 py-3 font-bold text-white hover:bg-pink-800 disabled:opacity-60 disabled:cursor-not-allowed";
export const recoveryLinkClass = "inline-block rounded p-2 text-pink-700 underline underline-offset-2";

export default function PasswordRecoveryLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-pink-50 p-4">
      <div className="w-full min-w-0 max-w-md rounded-[2rem] bg-white p-6 shadow-sm sm:p-8 [overflow-wrap:anywhere]">
        <h1 className="mb-6 text-center text-2xl font-bold text-pink-600">{title}</h1>
        {children}
      </div>
    </main>
  );
}
