/** exportedAtの時刻を、ブラウザーのローカル日付へ変換する。 */
export function formatExportLocalDate(exportedAt: string): string {
  const date = new Date(exportedAt);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
