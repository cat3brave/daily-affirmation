import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// 📱 アプリのテーマカラー（スマホ画面の一番上、時計や電池のアイコンがあるバーの色）
export const viewport: Viewport = {
  themeColor: "#e0f2fe",
};

// 📄 PWA（スマホアプリ化）のための身分証明書と設定
export const metadata: Metadata = {
  title: "Daily Affirmation",
  description: "自分を労わるためのお守りアプリ",
  manifest: "/manifest.json", // 先ほど作った証明書を読み込む
  appleWebApp: {
    capable: true, // Safariで「ホーム画面に追加」した時にアプリとして動かす魔法
    statusBarStyle: "default",
    title: "お守り", // ホーム画面に並ぶときの短い名前
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
