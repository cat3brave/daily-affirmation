import { useRef, useState } from "react";
import { generateAffirmation } from "../actions";

export function useAffirmationGenerator() {
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isGeneratingRef = useRef(false);

  const handleGenerateAffirmation = async () => {
    if (isGeneratingRef.current) return;

    isGeneratingRef.current = true;
    setIsLoading(true);
    setText("");

    try {
      const newText = await generateAffirmation();
      setText(newText);
    } catch {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      isGeneratingRef.current = false;
      setIsLoading(false);
    }
  };

  return { text, isLoading, handleGenerateAffirmation };
}
