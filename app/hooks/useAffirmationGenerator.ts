import { useRef, useState } from "react";
import { generateAffirmation } from "../actions";

export function useAffirmationGenerator() {
  const [text, setText] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isGeneratingRef = useRef(false);

  const handleGenerateAffirmation = async () => {
    if (isGeneratingRef.current) return;

    isGeneratingRef.current = true;
    setIsLoading(true);
    setText("");
    setAuthError("");

    try {
      const result = await generateAffirmation();
      if (result.status === "auth_required") {
        setAuthError(result.message);
      } else if (result.status === "success" || result.status === "fallback") {
        setText(result.text);
      }
    } catch {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      isGeneratingRef.current = false;
      setIsLoading(false);
    }
  };

  return { text, authError, isLoading, handleGenerateAffirmation };
}
