import "server-only";
import type { GenerativeModel } from "@google/generative-ai";

export const GEMINI_TIMEOUT_MS = 15_000;
export class GeminiTimeoutError extends Error {
  constructor() {
    super("Gemini request timed out");
  }
}

export async function generateGeminiText(model: GenerativeModel, prompt: string) {
  const controller = new AbortController();
  const listeners: Array<() => void> = [];
  // SDK 0.24.1 forwards abort to fetch but does not remove its forwarding listener.
  // Keep its supported signal interface and release those listeners on every exit.
  const signal = new Proxy(controller.signal, {
    get(target, property) {
      if (property === "addEventListener") {
        return (...args: Parameters<AbortSignal["addEventListener"]>) => {
          target.addEventListener(...args);
          listeners.push(() => target.removeEventListener(args[0], args[1], args[2]));
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
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
    // generateContent awaits response.json(); text extraction is also inside the bound.
    const request = (async () => {
      const result = await model.generateContent(prompt, { signal });
      const text = result.response.text().trim();
      if (timedOut) throw new GeminiTimeoutError();
      return text;
    })();
    // Abort is requested above even if a transport fails to settle promptly.
    // race attaches rejection handlers to late failures; late values are never adopted.
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
    listeners.forEach((remove) => remove());
  }
}
