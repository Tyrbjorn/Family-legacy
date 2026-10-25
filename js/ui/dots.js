// R77 "new" dots (pure; node-testable). A dot marks a sub-tab that has something new in it. Silent (no motion, no sound, no toast),
// cleared the moment you open that sub-tab, remembered per save slot in fl_ui_v1. The first time a slot is looked at, everything that
// already exists is marked seen so a long-running save does not light up all at once.
//   newKeys(s, h) -> [{ key, view }]   h = { craft:bool, storyNext:string|null }   (read-only: nothing here writes to `s`)
export function newKeys(s, h = {}) {
  const k = [];
  if (h.craft) k.push({ key: "craft", view: "craft" });
  for (const su of (s && s.suitors) || []) k.push({ key: "su:" + su.id, view: "courtship" });
  if (h.storyNext) k.push({ key: "st:" + h.storyNext, view: "story" });
  return k;
}
const rec = (ui, slot) => (ui.seen[String(slot)] ||= { i: 0, views: {}, ev: {} });
// Returns the set of views that currently show a dot, after the silent first-look pass. `visit` is the view being opened (its dots clear).
// Mutates only `ui`. Returns { dots:{view:true}, changed:bool }.
export function syncDots(ui, slot, keys, visit) {
  if (!(slot >= 1)) return { dots: {}, changed: false };
  const r = rec(ui, slot);
  let changed = false;
  if (!r.i) { r.i = 1; for (const x of keys) r.ev[x.key] = 1; changed = true; }
  if (visit) { r.views[visit] = 1; for (const x of keys) if (x.view === visit && !r.ev[x.key]) { r.ev[x.key] = 1; changed = true; } }
  const dots = {};
  for (const x of keys) if (!r.ev[x.key]) dots[x.view] = true;
  return { dots, changed };
}
