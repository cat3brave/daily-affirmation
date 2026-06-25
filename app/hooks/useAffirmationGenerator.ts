import { useState } from "react";
import { generateAffirmation } from "../actions";

export function useAffirmationGenerator() {
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGenerateAffirmation = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setText("");

    try {
      const newText = await generateAffirmation();
      setText(newText);
    } catch {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      setIsLoading(false);
    }
  };

  return { text, isLoading, handleGenerateAffirmation };
}
