import { useEffect, useRef, useState } from "react";

const CLOUD_FLOAT_DURATION_MS = 8000;

type FloatingCloud = { id: string; text: string; x: number; y: number };

export function useFloatingClouds() {
  const [floatingClouds, setFloatingClouds] = useState<FloatingCloud[]>([]);
  const cloudTimeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      cloudTimeoutIds.current.forEach((timeoutId) => clearTimeout(timeoutId));
      cloudTimeoutIds.current = [];
    };
  }, []);

  const handleFloatCloud = (cloudText: string) => {
    const cloudId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const newCloud = {
      id: cloudId,
      text: cloudText,
      x: (Math.random() - 0.5) * 100,
      y: -300 - Math.random() * 100,
    };

    setFloatingClouds((prev) => [...prev, newCloud]);

    const timeoutId = setTimeout(() => {
      setFloatingClouds((prev) => prev.filter((c) => c.id !== newCloud.id));
      cloudTimeoutIds.current = cloudTimeoutIds.current.filter(
        (currentTimeoutId) => currentTimeoutId !== timeoutId,
      );
    }, CLOUD_FLOAT_DURATION_MS);

    cloudTimeoutIds.current.push(timeoutId);
  };

  return { floatingClouds, handleFloatCloud };
}
