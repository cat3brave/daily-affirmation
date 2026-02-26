import type { Metadata } from "next";
// 1. Google Fontsから「Zen Maru Gothic」をインポート
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

// 2. フォントの設定（太さのバリエーションを指定）
const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Affirmation",
  description: "心を整える肯定文アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 言語設定を日本語(ja)に変更
    <html lang="ja">
      {/* 3. bodyタグにフォントのクラス名を適用 */}
      <body className={zenMaruGothic.className}>{children}</body>
    </html>
  );
}
