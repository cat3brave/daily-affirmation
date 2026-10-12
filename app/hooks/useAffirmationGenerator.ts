import { useDashboardOperation } from "./dashboardAuth";
import { useRef, useState } from "react";
import { generateAffirmation } from "../actions";

export function useAffirmationGenerator() {
  const { capture } = useDashboardOperation();
  const [text, setText] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [rateLimitError, setRateLimitError] = useState<string>("");
  const [timeoutError, setTimeoutError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isGeneratingRef = useRef(false);

  const handleGenerateAffirmation = async () => {
    const current = capture();
    if (!current()) return;
    if (isGeneratingRef.current) return;

    isGeneratingRef.current = true;
    setIsLoading(true);
    setText("");
    setAuthError("");
    setRateLimitError("");
    setTimeoutError("");

    try {
      const result = await generateAffirmation();
      if (!current()) return;
      if (result.status === "auth_required") {
        setAuthError(result.message);
      } else if (result.status === "rate_limited") {
        setRateLimitError(result.message);
      } else if (result.status === "timed_out") {
        setTimeoutError(result.message);
        setText(result.text);
      } else if (result.status === "success" || result.status === "fallback") {
        setText(result.text);
      }
    } catch {
      if (!current()) return;
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      if (current()) {
        isGeneratingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return {
    text,
    authError,
    rateLimitError,
    timeoutError,
    isLoading,
    handleGenerateAffirmation,
  };
}
