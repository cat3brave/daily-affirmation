type FavoriteAffirmationsListProps = {
  favoriteAffirmations: string[];
  favoriteError: string;
  handleRemoveFavoriteAffirmation: (affirmation: string) => void;
};

export default function FavoriteAffirmationsList({
  favoriteAffirmations,
  favoriteError,
  handleRemoveFavoriteAffirmation,
}: FavoriteAffirmationsListProps) {
  if (favoriteAffirmations.length === 0 && !favoriteError) {
    return null;
  }

  return (
    <div className="mb-10 w-full max-w-md bg-white/50 backdrop-blur-sm p-5 rounded-3xl border border-pink-100 shadow-sm">
      <p className="text-pink-500 font-bold mb-3 text-center tracking-wide">
        🌷 お気に入りの言葉
      </p>

      {favoriteError && (
        <p
          role="alert"
          className="mb-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm leading-relaxed text-rose-600"
        >
          {favoriteError}
        </p>
      )}

      {favoriteAffirmations.length > 0 && (
        <ul className="space-y-2">
          {favoriteAffirmations.map((affirmation, index) => (
            <li
              key={`${affirmation}-${index}`}
              className="bg-white/80 border border-pink-100 rounded-2xl px-4 py-3 text-sm text-pink-700 leading-relaxed flex items-start justify-between gap-3"
            >
              <span className="flex-1">{affirmation}</span>

              <button
                type="button"
                onClick={() => handleRemoveFavoriteAffirmation(affirmation)}
                className="shrink-0 text-xs text-pink-400 hover:text-pink-600 font-bold"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
