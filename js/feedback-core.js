// Pure helpers for the playtest feedback panel (no DOM; tested in test/feedback.test.mjs). No tracking: nothing is sent unless the tester opens the form.
export const FB_FIELDS = [
  ["confused", "What confused you?"],
  ["bored", "What bored you?"],
  ["tooMuch", "What feels like too much, too clunky or overcomplicated? What would you cut or simplify?"],
  ["notes", "Anything else? (optional)"],
];
const hms = sec => `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m`;
// generation = deepest parent chain among family members (founder = 1)
export function generationOf(s) {
  const by = new Map((s.members || []).map(m => [m.id, m])), memo = new Map();
  const g = (m, d = 0) => {
    if (!m || d > 50) return 0;
    if (memo.has(m.id)) return memo.get(m.id);
    const v = 1 + Math.max(0, ...(m.parents || []).map(p => g(by.get(p), d + 1)));
    memo.set(m.id, v);
    return v;
  };
  return Math.max(1, ...(s.members || []).filter(m => !m.minion).map(m => g(m)));
}
export function feedbackContext(s, { build, schema, yearDays, ua }) {
  return {
    build,
    save: `v${schema}`,
    year: Math.floor((s.day || 0) / yearDays) + 1,
    generation: generationOf(s),
    playTime: hms(s.playSec || 0),
    device: ua || "",
  };
}
export const contextText = c => `Build ${c.build} · save ${c.save} · year ${c.year} · generation ${c.generation} · play time ${c.playTime} · ${c.device}`;
export function feedbackText(a, c) {
  return [
    `Heirs of the Hold playtest feedback (${c.build})`,
    `Fun: ${a.fun || "-"}/5`,
    ...FB_FIELDS.map(([k, q]) => `${q}\n${(a[k] || "").trim() || "-"}`),
    `Keep playing tomorrow? ${a.tomorrow || "-"}`,
    `Context: ${contextText(c)}`,
  ].join("\n\n");
}
export const formReady = F => !!(F && F.formUrl && String(F.formUrl).trim());
export function prefillUrl(F, a, c) {
  if (!formReady(F)) return null;
  const base = F.formUrl.trim().replace(/[?#].*$/, "").replace(/\/(viewform|formResponse)?\/?$/, "") + "/viewform";
  const vals = { ...a, context: contextText(c) };
  const q = Object.entries(F.entries || {})
    .filter(([k, id]) => id && vals[k] != null && String(vals[k]).trim() !== "")
    .map(([k, id]) => `entry.${String(id).replace(/^entry\./, "")}=${encodeURIComponent(String(vals[k]))}`);
  return `${base}?usp=pp_url${q.length ? "&" + q.join("&") : ""}`;
}
