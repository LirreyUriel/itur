export type SortDir = "asc" | "desc";

export type SortState<K extends string> = {
  key: K;
  dir: SortDir;
};

export function toggleSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, dir: "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

export function compareValues(a: string | number | boolean, b: string | number | boolean, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * mul;
  if (typeof a === "boolean" && typeof b === "boolean") return (Number(a) - Number(b)) * mul;
  return String(a).localeCompare(String(b), "he", { numeric: true, sensitivity: "base" }) * mul;
}
