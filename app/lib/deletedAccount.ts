const PREFIX = "daily-affirmation:deleted-account:";
export const ACCOUNT_DELETED_EVENT = "daily-affirmation:account-deleted";
export function isAccountDeleted(userId: string): boolean {
  try { return window.localStorage.getItem(PREFIX + userId) === "true"; } catch { return false; }
}
export function markAccountDeleted(userId: string): boolean {
  let persisted = true;
  try { window.localStorage.setItem(PREFIX + userId, "true"); } catch { persisted = false; }
  window.dispatchEvent(new CustomEvent(ACCOUNT_DELETED_EVENT, { detail: userId }));
  return persisted;
}
export function isDeletionStorageKey(key: string | null, userId: string) {
  return key === PREFIX + userId;
}
