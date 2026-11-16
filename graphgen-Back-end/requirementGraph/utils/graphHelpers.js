export const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
};

export const isMeaningfulText = (value) => typeof value === "string" ? value.trim().length > 0 : Boolean(value);

export const normalizeText = (value) => typeof value === "string" ? value.trim() : "";

export const camelToSentence = (value = "") => normalizeText(value)
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ");

export const safeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const idFromText = (prefix, text) => {
  const base = normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "item";
  return `${prefix}_${base}_${Date.now().toString(36)}`;
};

export const makeUniqueId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const stableStringify = (value) => JSON.stringify(value, Object.keys(value || {}).sort());
