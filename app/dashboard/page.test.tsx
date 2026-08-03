import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DashboardTab = "home" | "work" | "amulet";
type SupabaseClientStub = {
  readonly kind: "supabase-stub";
};
type WindowSize = {
  width: number;
  height: number;
};
type AuthUserReturn = {
  supabase: SupabaseClientStub;
  userId: string | null;
  userEmail: string | null;
  isAuthChecked: boolean;
};
type AffirmationGeneratorReturn = {
  text: string;
  isLoading: boolean;
  handleGenerateAffirmation: () => void;
};
type FavoriteAffirmationsReturn = {
  favoriteAffirmations: string[];
  favoriteError: string;
  handleFavoriteAffirmation: (text: string) => Promise<void>;
  handleRemoveFavoriteAffirmation: (affirmation: string) => void;
  isFavorite: (text: string) => boolean;
};
type FlowerGardenReturn = {
  growth: number;
  totalBlooms: number;
  currentFlower: string;
  isBloomSaving: boolean;
  flowerError: string;
  bloomRefreshKey: number;
  handleWalk: () => Promise<void>;
};
type FloatingCloud = {
  id: string;
  text: string;
};
type FloatingCloudsReturn = {
  floatingClouds: FloatingCloud[];
  handleFloatCloud: (text: string) => void;
};
type WindowSizeReturn = {
  windowSize: WindowSize;
};
type HomeTabProps = {
  isLoading: boolean;
  text: string;
  handleClick: () => void;
  handleFavoriteAffirmation: () => void;
  handleRemoveFavoriteAffirmation: (affirmation: string) => void;
  isFavoriteDisabled: boolean;
  favoriteAffirmations: string[];
  favoriteError: string;
  totalBlooms: number;
  growth: number;
  currentFlower: string;
  isBloomSaving: boolean;
  flowerError: string;
  handleWalk: () => void | Promise<void>;
  setShowTada: (value: boolean) => void;
};
type WorkTabProps = {
  handleFloatCloud: (text: string) => void;
};
type AmuletTabProps = {
  setShowTada: (value: boolean) => void;
};
type DashboardHeaderProps = {
  currentTab: DashboardTab;
  isBirdView: boolean;
  onToggleBirdView: () => void;
  userEmail: string | null;
};
type BirdViewPanelProps = {
  currentTab: DashboardTab;
  isBirdView: boolean;
  totalBlooms: number;
};
type FloatingCloudLayerProps = {
  floatingClouds: FloatingCloud[];
};
type BloomGraphProps = {
  refreshKey: number;
};
type TadaModalProps = {
  showTada: boolean;
  setShowTada: (value: boolean) => void;
  windowSize: WindowSize;
};

const dashboardMocks = vi.hoisted(() => {
  const createSupabaseBrowserClient = vi.fn<() => SupabaseClientStub>();
  const useAuthUser = vi.fn<() => AuthUserReturn>();
  const useAffirmationGenerator = vi.fn<() => AffirmationGeneratorReturn>();
  const useFavoriteAffirmations = vi.fn<
    (userId: string | null, supabase: SupabaseClientStub) => FavoriteAffirmationsReturn
  >();
  const useFlowerGarden = vi.fn<
    (userId: string | null, supabase: SupabaseClientStub) => FlowerGardenReturn
  >();
  const useFloatingClouds = vi.fn<() => FloatingCloudsReturn>();
  const useWindowSize = vi.fn<() => WindowSizeReturn>();
  const renderHomeTab = vi.fn<(props: HomeTabProps) => void>();
  const renderWorkTab = vi.fn<(props: WorkTabProps) => void>();
  const renderAmuletTab = vi.fn<(props: AmuletTabProps) => void>();
  const renderDashboardHeader = vi.fn<(props: DashboardHeaderProps) => void>();
  const renderBirdViewPanel = vi.fn<(props: BirdViewPanelProps) => void>();
  const renderFloatingCloudLayer = vi.fn<(props: FloatingCloudLayerProps) => void>();
  const renderBloomGraph = vi.fn<(props: BloomGraphProps) => void>();
  const renderTadaModal = vi.fn<(props: TadaModalProps) => void>();
  const saveFavoriteAffirmation = vi.fn<(text: string) => Promise<void>>();
  const handleRemoveFavoriteAffirmation = vi.fn<(affirmation: string) => void>();
  const isFavorite = vi.fn<(text: string) => boolean>();
  const handleGenerateAffirmation = vi.fn<() => void>();
  const handleWalk = vi.fn<() => Promise<void>>();
  const handleFloatCloud = vi.fn<(text: string) => void>();

  return {
    createSupabaseBrowserClient,
    handleFloatCloud,
    handleGenerateAffirmation,
    handleRemoveFavoriteAffirmation,
    handleWalk,
    isFavorite,
    renderAmuletTab,
    renderBirdViewPanel,
    renderBloomGraph,
    renderDashboardHeader,
    renderFloatingCloudLayer,
    renderHomeTab,
    renderTadaModal,
    renderWorkTab,
    saveFavoriteAffirmation,
    useAffirmationGenerator,
    useAuthUser,
    useFavoriteAffirmations,
    useFloatingClouds,
    useFlowerGarden,
    useWindowSize,
  };
});

vi.mock("../lib/supabaseClient", () => ({
  createSupabaseBrowserClient: dashboardMocks.createSupabaseBrowserClient,
}));

vi.mock("../hooks/useAuthUser", () => ({
  useAuthUser: dashboardMocks.useAuthUser,
}));

vi.mock("../hooks/useAffirmationGenerator", () => ({
  useAffirmationGenerator: dashboardMocks.useAffirmationGenerator,
}));

vi.mock("../hooks/useFavoriteAffirmations", () => ({
  useFavoriteAffirmations: dashboardMocks.useFavoriteAffirmations,
}));

vi.mock("../hooks/useFlowerGarden", () => ({
  useFlowerGarden: dashboardMocks.useFlowerGarden,
}));

vi.mock("../hooks/useFloatingClouds", () => ({
  useFloatingClouds: dashboardMocks.useFloatingClouds,
}));

vi.mock("../hooks/useWindowSize", () => ({
  useWindowSize: dashboardMocks.useWindowSize,
}));

vi.mock("../components/HomeTab", () => ({
  default: (props: HomeTabProps) => {
    dashboardMocks.renderHomeTab(props);

    return (
      <section data-testid="home-tab">
        <span data-testid="favorite-disabled-state">
          {String(props.isFavoriteDisabled)}
        </span>
        <button
          type="button"
          onClick={() => {
            void props.handleFavoriteAffirmation();
          }}
        >
          save current affirmation
        </button>
        <button type="button" onClick={() => props.setShowTada(true)}>
          open tada
        </button>
      </section>
    );
  },
}));

vi.mock("../components/WorkTab", () => ({
  default: (props: WorkTabProps) => {
    dashboardMocks.renderWorkTab(props);

    return <section data-testid="work-tab">WorkTab mock</section>;
  },
}));

vi.mock("../components/AmuletTab", () => ({
  default: (props: AmuletTabProps) => {
    dashboardMocks.renderAmuletTab(props);

    return <section data-testid="amulet-tab">AmuletTab mock</section>;
  },
}));

vi.mock("../components/DashboardHeader", () => ({
  default: (props: DashboardHeaderProps) => {
    dashboardMocks.renderDashboardHeader(props);

    return (
      <header
        data-bird-view={String(props.isBirdView)}
        data-current-tab={props.currentTab}
        data-testid="dashboard-header"
        data-user-email={props.userEmail ?? ""}
      >
        <button type="button" onClick={props.onToggleBirdView}>
          toggle bird view
        </button>
      </header>
    );
  },
}));

vi.mock("../components/BirdViewPanel", () => ({
  default: (props: BirdViewPanelProps) => {
    dashboardMocks.renderBirdViewPanel(props);

    return (
      <aside
        data-bird-view={String(props.isBirdView)}
        data-current-tab={props.currentTab}
        data-testid="bird-view-panel"
        data-total-blooms={String(props.totalBlooms)}
      />
    );
  },
}));

vi.mock("../components/FloatingCloudLayer", () => ({
  default: (props: FloatingCloudLayerProps) => {
    dashboardMocks.renderFloatingCloudLayer(props);

    return (
      <div
        data-cloud-count={String(props.floatingClouds.length)}
        data-testid="floating-cloud-layer"
      />
    );
  },
}));

vi.mock("../components/BloomGraph", () => ({
  default: (props: BloomGraphProps) => {
    dashboardMocks.renderBloomGraph(props);

    return (
      <section data-refresh-key={String(props.refreshKey)} data-testid="bloom-graph">
        BloomGraph mock
      </section>
    );
  },
}));

vi.mock("../components/TadaModal", () => ({
  default: (props: TadaModalProps) => {
    dashboardMocks.renderTadaModal(props);

    return (
      <div
        data-show-tada={String(props.showTada)}
        data-testid="tada-modal"
        data-window-height={String(props.windowSize.height)}
        data-window-width={String(props.windowSize.width)}
      >
        <button type="button" onClick={() => props.setShowTada(false)}>
          close tada
        </button>
      </div>
    );
  },
}));

import DashboardPage from "./page";

const supabaseStub: SupabaseClientStub = { kind: "supabase-stub" };
const favoriteAffirmations = ["朝の言葉", "夜のお守り"];
const floatingClouds: FloatingCloud[] = [{ id: "cloud-1", text: "少し休む" }];
const defaultAffirmationText = "今日のテスト用の言葉";

function configureDashboardMocks({
  affirmationText = defaultAffirmationText,
  favoriteError = "favorite error sample",
  flowerError = "flower error sample",
  isAuthChecked = true,
  isFavoriteResult = false,
  userEmail = "dashboard@example.com",
  userId = "user-dashboard-1",
}: {
  affirmationText?: string;
  favoriteError?: string;
  flowerError?: string;
  isAuthChecked?: boolean;
  isFavoriteResult?: boolean;
  userEmail?: string | null;
  userId?: string | null;
} = {}) {
  dashboardMocks.createSupabaseBrowserClient.mockReset();
  dashboardMocks.handleFloatCloud.mockReset();
  dashboardMocks.handleGenerateAffirmation.mockReset();
  dashboardMocks.handleRemoveFavoriteAffirmation.mockReset();
  dashboardMocks.handleWalk.mockReset();
  dashboardMocks.isFavorite.mockReset();
  dashboardMocks.renderAmuletTab.mockReset();
  dashboardMocks.renderBirdViewPanel.mockReset();
  dashboardMocks.renderBloomGraph.mockReset();
  dashboardMocks.renderDashboardHeader.mockReset();
  dashboardMocks.renderFloatingCloudLayer.mockReset();
  dashboardMocks.renderHomeTab.mockReset();
  dashboardMocks.renderTadaModal.mockReset();
  dashboardMocks.renderWorkTab.mockReset();
  dashboardMocks.saveFavoriteAffirmation.mockReset();
  dashboardMocks.useAffirmationGenerator.mockReset();
  dashboardMocks.useAuthUser.mockReset();
  dashboardMocks.useFavoriteAffirmations.mockReset();
  dashboardMocks.useFloatingClouds.mockReset();
  dashboardMocks.useFlowerGarden.mockReset();
  dashboardMocks.useWindowSize.mockReset();

  dashboardMocks.saveFavoriteAffirmation.mockResolvedValue(undefined);
  dashboardMocks.handleWalk.mockResolvedValue(undefined);
  dashboardMocks.isFavorite.mockReturnValue(isFavoriteResult);
  dashboardMocks.useAuthUser.mockReturnValue({
    supabase: supabaseStub,
    userEmail,
    userId,
    isAuthChecked,
  });
  dashboardMocks.useAffirmationGenerator.mockReturnValue({
    text: affirmationText,
    isLoading: false,
    handleGenerateAffirmation: dashboardMocks.handleGenerateAffirmation,
  });
  dashboardMocks.useFavoriteAffirmations.mockReturnValue({
    favoriteAffirmations,
    favoriteError,
    handleFavoriteAffirmation: dashboardMocks.saveFavoriteAffirmation,
    handleRemoveFavoriteAffirmation: dashboardMocks.handleRemoveFavoriteAffirmation,
    isFavorite: dashboardMocks.isFavorite,
  });
  dashboardMocks.useFlowerGarden.mockReturnValue({
    growth: 42,
    totalBlooms: 7,
    currentFlower: "チューリップ",
    isBloomSaving: true,
    flowerError,
    bloomRefreshKey: 12,
    handleWalk: dashboardMocks.handleWalk,
  });
  dashboardMocks.useFloatingClouds.mockReturnValue({
    floatingClouds,
    handleFloatCloud: dashboardMocks.handleFloatCloud,
  });
  dashboardMocks.useWindowSize.mockReturnValue({
    windowSize: { width: 1024, height: 768 },
  });
}

function getLastHomeTabProps() {
  const call = dashboardMocks.renderHomeTab.mock.calls.at(-1);
  if (!call) {
    throw new Error("HomeTab was not rendered.");
  }

  return call[0];
}

function getLastDashboardHeaderProps() {
  const call = dashboardMocks.renderDashboardHeader.mock.calls.at(-1);
  if (!call) {
    throw new Error("DashboardHeader was not rendered.");
  }

  return call[0];
}

function getLastBirdViewPanelProps() {
  const call = dashboardMocks.renderBirdViewPanel.mock.calls.at(-1);
  if (!call) {
    throw new Error("BirdViewPanel was not rendered.");
  }

  return call[0];
}

function getLastTadaModalProps() {
  const call = dashboardMocks.renderTadaModal.mock.calls.at(-1);
  if (!call) {
    throw new Error("TadaModal was not rendered.");
  }

  return call[0];
}

function clickTab(tabLabel: "ホーム" | "ワーク" | "お守り") {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(tabLabel) }));
}

beforeEach(() => {
  configureDashboardMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("認証確認前はログイン情報の確認表示を出す", () => {
    configureDashboardMocks({ isAuthChecked: false });

    render(<DashboardPage />);

    expect(
      screen.getByText("ログイン情報を確認しています..."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-header")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ホーム" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ワーク" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "お守り" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("bloom-graph")).not.toBeInTheDocument();
    expect(dashboardMocks.createSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it("認証確認後はホームタブと成長記録を初期表示する", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("home-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("work-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("amulet-tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("bloom-graph")).toHaveAttribute(
      "data-refresh-key",
      "12",
    );
    expect(dashboardMocks.renderBloomGraph).toHaveBeenLastCalledWith({
      refreshKey: 12,
    });
    expect(dashboardMocks.createSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it("ワークボタンでWorkTabへ切り替え成長記録を非表示にする", () => {
    render(<DashboardPage />);

    clickTab("ワーク");

    expect(screen.queryByTestId("home-tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("work-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("bloom-graph")).not.toBeInTheDocument();
  });

  it("お守りボタンでAmuletTabへ切り替える", () => {
    render(<DashboardPage />);

    clickTab("お守り");

    expect(screen.getByTestId("amulet-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("home-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("work-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bloom-graph")).not.toBeInTheDocument();
  });

  it("ホームへ戻るとHomeTabと成長記録を再表示する", () => {
    render(<DashboardPage />);

    clickTab("ワーク");
    expect(screen.queryByTestId("home-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bloom-graph")).not.toBeInTheDocument();

    clickTab("ホーム");

    expect(screen.getByTestId("home-tab")).toBeInTheDocument();
    expect(screen.getByTestId("bloom-graph")).toBeInTheDocument();
  });

  it("現在の言葉をお気に入り保存処理へ渡す", async () => {
    const currentText = "保存される現在の言葉";
    configureDashboardMocks({ affirmationText: currentText });
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "save current affirmation" }));

    await waitFor(() => {
      expect(dashboardMocks.saveFavoriteAffirmation).toHaveBeenCalledTimes(1);
    });
    expect(dashboardMocks.saveFavoriteAffirmation).toHaveBeenCalledWith(currentText);
  });

  it("ユーザーと言葉と登録状態からお気に入りdisabledを判定する", () => {
    const { rerender } = render(<DashboardPage />);
    expect(screen.getByTestId("favorite-disabled-state")).toHaveTextContent("false");
    expect(getLastHomeTabProps().isFavoriteDisabled).toBe(false);

    configureDashboardMocks({ userId: null });
    rerender(<DashboardPage />);
    expect(screen.getByTestId("favorite-disabled-state")).toHaveTextContent("true");
    expect(getLastHomeTabProps().isFavoriteDisabled).toBe(true);

    configureDashboardMocks({ affirmationText: "   " });
    rerender(<DashboardPage />);
    expect(screen.getByTestId("favorite-disabled-state")).toHaveTextContent("true");
    expect(getLastHomeTabProps().isFavoriteDisabled).toBe(true);

    configureDashboardMocks({ isFavoriteResult: true });
    rerender(<DashboardPage />);
    expect(screen.getByTestId("favorite-disabled-state")).toHaveTextContent("true");
    expect(getLastHomeTabProps().isFavoriteDisabled).toBe(true);

    configureDashboardMocks({ isFavoriteResult: false });
    rerender(<DashboardPage />);
    expect(screen.getByTestId("favorite-disabled-state")).toHaveTextContent("false");
    expect(getLastHomeTabProps().isFavoriteDisabled).toBe(false);
  });

  it("HomeTabから失敗モーダルを開閉できる", () => {
    render(<DashboardPage />);

    expect(getLastTadaModalProps().showTada).toBe(false);
    expect(screen.getByTestId("tada-modal")).toHaveAttribute(
      "data-show-tada",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "open tada" }));

    expect(getLastTadaModalProps().showTada).toBe(true);
    expect(screen.getByTestId("tada-modal")).toHaveAttribute("data-show-tada", "true");

    fireEvent.click(screen.getByRole("button", { name: "close tada" }));

    expect(getLastTadaModalProps().showTada).toBe(false);
    expect(screen.getByTestId("tada-modal")).toHaveAttribute(
      "data-show-tada",
      "false",
    );
  });

  it("ヘッダー操作で鳥の目線表示を切り替える", () => {
    render(<DashboardPage />);

    expect(getLastDashboardHeaderProps().isBirdView).toBe(false);
    expect(getLastBirdViewPanelProps().isBirdView).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "toggle bird view" }));

    expect(getLastDashboardHeaderProps().isBirdView).toBe(true);
    expect(getLastBirdViewPanelProps().isBirdView).toBe(true);
    expect(screen.getByTestId("dashboard-header")).toHaveAttribute(
      "data-bird-view",
      "true",
    );
    expect(screen.getByTestId("bird-view-panel")).toHaveAttribute(
      "data-bird-view",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "toggle bird view" }));

    expect(getLastDashboardHeaderProps().isBirdView).toBe(false);
    expect(getLastBirdViewPanelProps().isBirdView).toBe(false);
  });

  it("花とお気に入りの状態をHomeTabとBirdViewPanelへ渡す", () => {
    render(<DashboardPage />);

    expect(getLastHomeTabProps()).toMatchObject({
      isLoading: false,
      text: defaultAffirmationText,
      isFavoriteDisabled: false,
      favoriteAffirmations,
      favoriteError: "favorite error sample",
      totalBlooms: 7,
      growth: 42,
      currentFlower: "チューリップ",
      isBloomSaving: true,
      flowerError: "flower error sample",
    });
    expect(getLastHomeTabProps().handleClick).toBe(
      dashboardMocks.handleGenerateAffirmation,
    );
    expect(getLastHomeTabProps().handleRemoveFavoriteAffirmation).toBe(
      dashboardMocks.handleRemoveFavoriteAffirmation,
    );
    expect(getLastHomeTabProps().handleWalk).toBe(dashboardMocks.handleWalk);
    expect(getLastBirdViewPanelProps()).toMatchObject({
      currentTab: "home",
      isBirdView: false,
      totalBlooms: 7,
    });
    expect(getLastDashboardHeaderProps()).toMatchObject({
      currentTab: "home",
      isBirdView: false,
      userEmail: "dashboard@example.com",
    });
  });
});
