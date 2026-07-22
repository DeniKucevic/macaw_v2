// Helpers for the "email or username" login identifier. A member has exactly
// one of the two: an email (contains "@") or a username (does not).

/** True if the identifier looks like an email address. */
export function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Fold Serbian Latin diacritics to ASCII (Marković → Markovic). đ/Đ don't
 *  decompose via NFD, so they're mapped explicitly first. */
export function foldToAscii(s: string): string {
  return s
    .replace(/đ/g, "d") // đ
    .replace(/Đ/g, "D") // Đ
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip combining diacritical marks
}

/** Normalize a username the same way better-auth's username plugin does
 *  (lowercase). We also fold diacritics and strip anything that isn't a safe
 *  username character so what we store matches what login normalizes to. */
export function normalizeUsername(s: string): string {
  return foldToAscii(s).toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/** Base username suggestion: first name + first 2 letters of the last name,
 *  folded and lowercased (e.g. "Marko Marković" → "markoma"). Single-name
 *  people get just the folded first name. Callers add a numeric suffix if the
 *  result is already taken. */
export function suggestUsernameBase(name: string): string {
  const parts = foldToAscii(name.trim())
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0].replace(/[^a-z0-9]/g, "");
  const last = parts.length > 1 ? parts[parts.length - 1].replace(/[^a-z0-9]/g, "") : "";
  return (first + last.slice(0, 2)) || first;
}
