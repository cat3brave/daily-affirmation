import type { KeyboardEvent } from "react";

export type DashboardTab = "home" | "work" | "amulet";

export const dashboardTabs = [
  { id: "home", label: "ホーム" },
  { id: "work", label: "ワーク" },
  { id: "amulet", label: "お守り" },
] as const;

export const getDashboardTabId = (tab: DashboardTab) => `dashboard-tab-${tab}`;
export const getDashboardPanelId = (tab: DashboardTab) =>
  `dashboard-panel-${tab}`;

type BottomTabBarProps = {
  currentTab: DashboardTab;
  setCurrentTab: (tab: DashboardTab) => void;
};

export default function BottomTabBar({
  currentTab,
  setCurrentTab,
}: BottomTabBarProps) {
  const selectAndFocusTab = (tab: DashboardTab) => {
    setCurrentTab(tab);
    document.getElementById(getDashboardTabId(tab))?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: DashboardTab,
  ) => {
    const currentIndex = dashboardTabs.findIndex(({ id }) => id === tab);
    let nextIndex: number | undefined;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % dashboardTabs.length;
        break;
      case "ArrowLeft":
        nextIndex =
          (currentIndex - 1 + dashboardTabs.length) % dashboardTabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = dashboardTabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocusTab(dashboardTabs[nextIndex].id);
  };

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-6 pb-6 pt-2 pointer-events-none">
      <div
        aria-label="ダッシュボード"
        role="tablist"
        className="bg-white/70 backdrop-blur-xl border-2 border-white shadow-[0_10px_40px_rgb(0,0,0,0.1)] rounded-[2rem] flex justify-around items-center p-2 pointer-events-auto"
      >
        {dashboardTabs.map(({ id, label }) => {
          const isSelected = currentTab === id;
          const selectedClasses =
            id === "amulet"
              ? "bg-yellow-100/80 shadow-inner"
              : "bg-sky-100/80 shadow-inner";
          const hoverClasses =
            id === "amulet" ? "hover:bg-yellow-50" : "hover:bg-sky-50";
          const textClasses =
            id === "amulet"
              ? isSelected
                ? "text-yellow-600"
                : "text-yellow-600/50"
              : isSelected
                ? "text-sky-600"
                : "text-sky-600/50";

          return (
            <button
              key={id}
              id={getDashboardTabId(id)}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={isSelected}
              aria-controls={getDashboardPanelId(id)}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setCurrentTab(id)}
              onKeyDown={(event) => handleKeyDown(event, id)}
              className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${isSelected ? selectedClasses : hoverClasses}`}
            >
              <span
                className={`text-xl mb-1 ${isSelected ? "scale-110" : "opacity-70"}`}
              >
                {id === "home" ? "🏠" : id === "work" ? "☁️" : "🎉"}
              </span>
              <span className={`text-[10px] font-bold ${textClasses}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
