import "server-only";
import { GoogleGenAI } from "@google/genai";

export const GEMINI_TIMEOUT_MS = 15_000;
export class GeminiTimeoutError extends Error {
  constructor() {
    super("Gemini request timed out");
  }
}

export async function generateGeminiText(apiKey: string, prompt: string) {
  const controller = new AbortController();
  const signal = controller.signal;
  const listeners: Array<() => void> = [];
  // 2.31.0 retains its forwarding listener after successful body consumption.
  // Use a real AbortSignal (no Proxy), tracking subscriptions for every exit,
  // including transports that ignore abort and never settle.
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (...args: Parameters<AbortSignal["addEventListener"]>) => {
    add(...args);
    listeners.push(() => remove(...args));
  };
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new GeminiTimeoutError());
    }, GEMINI_TIMEOUT_MS);
  });
  try {
    const request = (async () => {
      const client = new GoogleGenAI({ apiKey });
      const result = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          abortSignal: signal,
          httpOptions: { retryOptions: { attempts: 1 } },
          automaticFunctionCalling: { disable: true },
          automaticContinuation: false,
        },
      });
      // Avoid the SDK text getter's diagnostic logging for mixed/tool responses.
      // Only a complete, usable text response may become UI success.
      const candidate = result.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        throw new Error("Unusable Gemini response");
      }
      const parts = candidate?.content?.parts;
      if (!parts?.length || parts.some(part =>
        (part.text !== undefined && typeof part.text !== "string") ||
        Object.keys(part).some(key => !["text", "thought", "thoughtSignature"].includes(key)))) {
        throw new Error("Unusable Gemini response");
      }
      const text = parts.filter(part => !part.thought).map(part => part.text ?? "").join("").trim();
      if (!text) throw new Error("Empty Gemini response");
      if (timedOut) throw new GeminiTimeoutError();
      return text;
    })();
    // race observes late rejections and never adopts a late result.
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
    listeners.forEach(remove => remove());
  }
}
