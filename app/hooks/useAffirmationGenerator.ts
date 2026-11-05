import { useDashboardOperation } from "./dashboardAuth";
import { useRef, useState } from "react";
import { generateAffirmation, type GenerationStatus } from "../actions";

export function useAffirmationGenerator() {
  const { capture } = useDashboardOperation();
  const [text, setText] = useState<string>("");
  const [resultStatus, setResultStatus] = useState<GenerationStatus | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const [rateLimitError, setRateLimitError] = useState<string>("");
  const [usageError, setUsageError] = useState<string>("");
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
    setResultStatus(null);
    setAuthError("");
    setRateLimitError("");
    setTimeoutError("");
    setUsageError("");

    try {
      const result = await generateAffirmation();
      if (!current()) return;
      if (result.status === "auth_required") {
        setAuthError(result.message);
      } else if (result.status === "rate_limited") {
        setRateLimitError(result.message);
      } else if (result.status === "usage_limited" || result.status === "usage_unavailable") {
        setUsageError(result.message);
      } else if (result.status === "timed_out") {
        setTimeoutError(result.message);
        setText(result.text);
        setResultStatus(result.status);
      } else if (result.status === "success" || result.status === "fallback") {
        setText(result.text);
        setResultStatus(result.status);
      }
    } catch {
      if (!current()) return;
      setText("自分に向ける言葉を、少し穏やかにしてもいいですね。");
      setResultStatus("fallback");
    } finally {
      if (current()) {
        isGeneratingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return {
    text,
    resultStatus,
    authError,
    rateLimitError,
    timeoutError,
    usageError,
    isLoading,
    handleGenerateAffirmation,
  };
}
