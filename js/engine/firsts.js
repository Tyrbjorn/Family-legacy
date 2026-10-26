// R84 (D9, D10, D37): one-time rewards for the Ledger of Firsts rows that can be read from the save, the Ground Ledger's "Walk the bounds"
// row (+renown) and finishing the Ground Ledger. State: s.firsts = { done: {id: day} } created lazily on the first day hook. The checks
// mirror js/ui/coach-logic.js (LCHECK / GCHECK) so what the player sees ticked is what pays; test/r84.test.mjs keeps them in step.
// No rng. A save already past `quietAfterDay` when this first runs has everything already true marked done with NO reward (no windfall).
import { D, living, log } from "./state.js";

const FD = () => D.firsts || null;
const arr = x => (Array.isArray(x) ? x : []);
const tut = s => s.tut || null;
const tutIds = s => arr(tut(s) && tut(s).done);
const nSteps = () => ((D.tutorial && D.tutorial.steps) || []).length;
const hasLand = s => arr(s.land).length > 0;
const built = s => Object.values(s.buildings || {}).some(v => v > 0) || arr(s.structures).length > 0;
const pathChosen = s => living(s).some(m => m.cls || m.guild || m.craft || m.prof);
const done = s => arr(s.doneQuests);
// like the Ledger's `td`: a skipped tutorial counts as done (for display), but pays nothing here
const td = (s, ...ids) => !!tut(s) && (!!tut(s).skipped || ids.every(i => tutIds(s).includes(i)));
export const LEDGER_CHECK = {
  larder: s => td(s, "food", "chop"),
  refine: s => td(s, "cook", "craft"),
  sell: s => td(s, "trade"),
  ground: s => hasLand(s),
  build: s => built(s),
  heirs: s => arr(s.suitors).some(x => x.affinity > 0) || living(s).some(m => m.spouse),
  guild: s => pathChosen(s),
};
export const GROUND_CHECK = {
  plot: s => hasLand(s),
  bounds: s => arr(s.explored).length > 0 || (!!tut(s) && (!!(tut(s).flags || {}).scouted || tutIds(s).includes("scout"))),
  bram: s => done(s).includes("haul_bram"),
  raise: s => built(s),
  hands: s => arr(s.minions).length > 0,
  granary: s => done(s).includes("g_arch_granary") || done(s).includes("g_hearth_bridge"),
  market: s => done(s).includes("merchant_run"),
  hall: s => ((s.union && s.union.tier) | 0) > 0,
};
export const groundFinished = s => Object.values(GROUND_CHECK).every(f => f(s));
const skipped = s => !!tut(s) && !!tut(s).skipped;

export function firstsDay(s) {
  const F = FD();
  if (!F || !s.members) return;
  const quiet0 = !s.firsts && (s.day | 0) > (F.quietAfterDay ?? 2);
  const st = (s.firsts ||= { done: {} });
  const pay = (id, label, r, quiet) => {
    st.done[id] = s.day | 0;
    if (quiet) return;
    const got = [];
    if (r.coin) { s.res.coin = (s.res.coin || 0) + r.coin; got.push(`+${r.coin} 🪙`); }
    if (r.renown) { s.renown = (s.renown || 0) + r.renown; got.push(`+${r.renown} renown`); }
    log(s, `📒 ${label} (${got.join(", ")})`);
  };
  for (const row of F.ledger) if (!(row.id in st.done) && LEDGER_CHECK[row.id](s)) pay(row.id, row.label, row, quiet0 || skipped(s));
  const B = F.bounds;
  if (B && !("bounds" in st.done) && hasLand(s) && GROUND_CHECK.bounds(s)) pay("bounds", B.label, B, quiet0 || skipped(s));
  const G = F.ground;
  if (G && !("ground_all" in st.done) && groundFinished(s)) pay("ground_all", G.label, G, quiet0);
}
// UI helper: the reward text for a Ledger row / the bounds row / the whole Ground Ledger, or "" when none
export function firstReward(id) {
  const F = FD();
  if (!F) return "";
  const r = id === "bounds" ? F.bounds : id === "ground_all" ? F.ground : (F.ledger || []).find(x => x.id === id);
  if (!r) return "";
  return [r.coin ? `+${r.coin} 🪙` : "", r.renown ? `+${r.renown} renown` : ""].filter(Boolean).join(", ");
}
