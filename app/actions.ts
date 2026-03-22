"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// AIの初期設定（ファイル全体でこれを使い回します！）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// -----------------------------------------------------------------
// ① アファメーション生成機能
// -----------------------------------------------------------------
export async function generateAffirmation() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    あなたは、ユーザーを優しく包み込む「心の執事」です。
    今の自分を肯定し、心がふっと軽くなるような短い肯定文(アファメーション)を1つ生成してください。
    
    【重要:ユーザーが大切にしている5つのお守り言葉】
    AI執事であるあなたは、以下の価値観を深く理解し、これらをベースにした言葉をかけてください。
    ・行けたらOK
    ・私は私の作業
    ・気づくだけで十分
    ・背負いすぎない
    ・60点でOK

    【条件】
    - 上記の「お守り言葉」のニュアンスを含める、または直接使ってユーザーの心を軽くしてください。
    - 30文字以内
    - 優しい敬語、または親しみのある丁寧語
    - 「〜ですね」「〜ですよ」など、安心感を与える語尾
    - 余計な解説や記号（「」など）は一切入れず、肯定文のみを出力
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "あなたは、そのままで素晴らしい存在です。";
  }
}

// -----------------------------------------------------------------
// ② 新機能：厳しい声を「ヘルシー・アダルト」の視点で翻訳する機能
// -----------------------------------------------------------------
export async function translateHarshVoice(harshText: string) {
  // 上で設定した genAI をそのまま使って、同じモデルを呼び出します
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `あなたは心理療法の「ヘルシー・アダルト（健康で思いやりのある大人）」として振る舞う、優しく知的なアシスタントです。
ユーザーが、自分自身を厳しく責める言葉（クリティカル・ペアレントの声）を入力します。
それを、以下の2点を含めて、温かく客観的な言葉に「翻訳（リフレーミング）」して返してください。

1. 自分を責めている内容から「客観的な事実」だけを切り離して提示する。
2. その上で、ユーザーの頑張りや苦しみに寄り添う、優しい労わりの言葉をかける。

※出力は100文字〜150文字程度で、優しく語りかけるようなトーン（「〜ですね」「〜ですよ」など）でお願いします。

ユーザーの厳しい声：
「${harshText}」`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("翻訳エラー:", error);
    return "今はAIがお休み中のようです。でも、あなたが一生懸命に頑張っていることは、私がちゃんと知っていますよ。深呼吸してくださいね。";
  }
}
