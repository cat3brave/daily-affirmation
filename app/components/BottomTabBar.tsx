type BottomTabBarProps = {
  currentTab: "home" | "work" | "amulet";
  setCurrentTab: (tab: "home" | "work" | "amulet") => void;
};

export default function BottomTabBar({
  currentTab,
  setCurrentTab,
}: BottomTabBarProps) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-6 pb-6 pt-2 pointer-events-none">
      <div className="bg-white/70 backdrop-blur-xl border-2 border-white shadow-[0_10px_40px_rgb(0,0,0,0.1)] rounded-[2rem] flex justify-around items-center p-2 pointer-events-auto">
        <button
          onClick={() => setCurrentTab("home")}
          className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${currentTab === "home" ? "bg-sky-100/80 shadow-inner" : "hover:bg-sky-50"}`}
        >
          <span
            className={`text-xl mb-1 ${currentTab === "home" ? "scale-110" : "opacity-70"}`}
          >
            🏠
          </span>
          <span
            className={`text-[10px] font-bold ${currentTab === "home" ? "text-sky-600" : "text-sky-600/50"}`}
          >
            ホーム
          </span>
        </button>
        <button
          onClick={() => setCurrentTab("work")}
          className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${currentTab === "work" ? "bg-sky-100/80 shadow-inner" : "hover:bg-sky-50"}`}
        >
          <span
            className={`text-xl mb-1 ${currentTab === "work" ? "scale-110" : "opacity-70"}`}
          >
            ☁️
          </span>
          <span
            className={`text-[10px] font-bold ${currentTab === "work" ? "text-sky-600" : "text-sky-600/50"}`}
          >
            ワーク
          </span>
        </button>
        <button
          onClick={() => setCurrentTab("amulet")}
          className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${currentTab === "amulet" ? "bg-yellow-100/80 shadow-inner" : "hover:bg-yellow-50"}`}
        >
          <span
            className={`text-xl mb-1 ${currentTab === "amulet" ? "scale-110" : "opacity-70"}`}
          >
            🎉
          </span>
          <span
            className={`text-[10px] font-bold ${currentTab === "amulet" ? "text-yellow-600" : "text-yellow-600/50"}`}
          >
            お守り
          </span>
        </button>
      </div>
    </div>
  );
}
