import { useState, useEffect } from "react";

export function useFlowerGarden() {
  // 1. お花の状態を管理（店長から引き継ぎ！）
  const [growth, setGrowth] = useState<number>(0);
  const [totalBlooms, setTotalBlooms] = useState<number>(0);
  const [currentFlower, setCurrentFlower] = useState<string>("🌸");

  // 2. スマホの記憶（localStorage）から過去のデータを読み込む
  useEffect(() => {
    const storedGrowth = localStorage.getItem("flowerGrowth");
    if (storedGrowth) setGrowth(parseInt(storedGrowth, 10));
    const storedTotal = localStorage.getItem("totalBlooms");
    if (storedTotal) setTotalBlooms(parseInt(storedTotal, 10));
    const storedFlower = localStorage.getItem("currentFlower");
    if (storedFlower) setCurrentFlower(storedFlower);
  }, []);

  // 3. お花を育てる計算ロジック
  const handleWalk = () => {
    const flowerStages = ["🌰", "🌱", "🌿", "🌷", "🌸"];
    let nextGrowth = 0;
    if (growth >= flowerStages.length - 1) {
      nextGrowth = 0;
      const newTotal = totalBlooms + 1;
      setTotalBlooms(newTotal);
      localStorage.setItem("totalBlooms", newTotal.toString());
    } else {
      nextGrowth = growth + 1;
      if (nextGrowth === flowerStages.length - 1) {
        const rand = Math.random();
        let nextFlower = "🌸";
        if (rand > 0.7) {
          const rareFlowers = ["🌺", "🌻", "🌼", "🍀", "🌹", "🍄"];
          nextFlower =
            rareFlowers[Math.floor(Math.random() * rareFlowers.length)];
        }
        setCurrentFlower(nextFlower);
        localStorage.setItem("currentFlower", nextFlower);
      }
    }
    setGrowth(nextGrowth);
    localStorage.setItem("flowerGrowth", nextGrowth.toString());
  };

  // 4. 計算結果と関数だけを店長（page.tsx）に渡す！
  return { growth, totalBlooms, currentFlower, handleWalk };
}
