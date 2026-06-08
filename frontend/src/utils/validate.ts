export const isEmail = (s: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());

/** True when the string is a finite number > 0. */
export const isPositiveNumber = (s: string): boolean => {
  const n = parseFloat(s);
  return !isNaN(n) && isFinite(n) && n > 0;
};

/** True when the string is a finite number >= 0. */
export const isNonNegativeNumber = (s: string): boolean => {
  const n = parseFloat(s);
  return !isNaN(n) && isFinite(n) && n >= 0;
};

export const clampPercent = (n: number): number => Math.max(0, Math.min(100, n));

/** Extract a human-readable message from a thrown API error. */
export const errMessage = (e: any, fallback = "Something went wrong. Please try again."): string =>
  (e && (e.message || e.detail)) || fallback;
