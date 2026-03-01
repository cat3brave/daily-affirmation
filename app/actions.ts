"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateAffirmation() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // ★変更点：AIへの指示（プロンプト）に、あなたの大切な5つの言葉を教え込みました！
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
