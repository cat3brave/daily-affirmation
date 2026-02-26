"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
export async function generateAffirmation() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    あなたは、ユーザーを優しく包み込む「心の執事」です。
    今の自分を肯定し、心がふっと軽くなるような短い肯定文(アファメーション)を1つ生成してください。
    
    【条件】
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
    return "あなたは、そのままで素晴らしい存在です!";
  }
}
