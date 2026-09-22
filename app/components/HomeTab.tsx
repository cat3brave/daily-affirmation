import AffirmationSection from "./AffirmationSection";
import FavoriteAffirmationsList from "./FavoriteAffirmationsList";
import FlowerGardenSection from "./FlowerGardenSection";

// 親（page.tsx）から受け取るデータの型を定義します
type HomeTabProps = {
  isLoading: boolean;
  text: string;
  affirmationAuthError: string;
  handleClick: () => void;
  handleFavoriteAffirmation: () => void;
  handleRemoveFavoriteAffirmation: (affirmation: string) => void;
  isFavoriteDisabled: boolean;
  favoriteAffirmations: string[];
  favoriteError: string;
  favoriteLoadError: string;
  isReloadingFavorites: boolean;
  reloadFavoriteAffirmations: () => void;
  totalBlooms: number;
  growth: number;
  currentFlower: string;
  isBloomSaving: boolean;
  flowerError: string;
  flowerLoadError: string;
  isReloadingBlooms: boolean;
  reloadBlooms: () => void;
  handleWalk: () => void | Promise<void>;
  setShowTada: (value: boolean) => void;
};

export default function HomeTab({
  isLoading,
  text,
  affirmationAuthError,
  handleClick,
  handleFavoriteAffirmation,
  handleRemoveFavoriteAffirmation,
  isFavoriteDisabled,
  favoriteAffirmations,
  favoriteError,
  favoriteLoadError,
  isReloadingFavorites,
  reloadFavoriteAffirmations,
  totalBlooms,
  growth,
  currentFlower,
  isBloomSaving,
  flowerError,
  flowerLoadError,
  isReloadingBlooms,
  reloadBlooms,
  handleWalk,
  setShowTada,
}: HomeTabProps) {
  return (
    <div className="w-full flex flex-col items-center">
      <AffirmationSection
        isLoading={isLoading}
        text={text}
        authError={affirmationAuthError}
        handleClick={handleClick}
        handleFavoriteAffirmation={handleFavoriteAffirmation}
        isFavoriteDisabled={isFavoriteDisabled}
      />

      <FavoriteAffirmationsList
        favoriteAffirmations={favoriteAffirmations}
        favoriteError={favoriteError}
        favoriteLoadError={favoriteLoadError}
        isReloading={isReloadingFavorites}
        onReload={reloadFavoriteAffirmations}
        handleRemoveFavoriteAffirmation={handleRemoveFavoriteAffirmation}
      />

      <FlowerGardenSection
        totalBlooms={totalBlooms}
        growth={growth}
        currentFlower={currentFlower}
        isBloomSaving={isBloomSaving}
        flowerError={flowerError}
        flowerLoadError={flowerLoadError}
        isReloadingBlooms={isReloadingBlooms}
        reloadBlooms={reloadBlooms}
        handleWalk={handleWalk}
      />

      {/* 5. 失敗の告白ボタン */}
      <div className="mt-8 mb-4">
        <button
          type="button"
          onClick={() => setShowTada(true)}
          className="inline-flex min-h-6 items-center text-sm text-sky-500/60 hover:text-sky-500 transition-colors decoration-sky-300/50 underline underline-offset-4"
        >
          今日、ちょっと失敗しちゃった...
        </button>
      </div>
    </div>
  );
}
