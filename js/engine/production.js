// Estate production: daily furniture processes, operator skill, reserves/pausing and food/crop quality.
// Split from estate.js (re-exported there, so imports elsewhere are unchanged).
import { seasonYield } from "./seasons.js";
import { resGain } from "./legacy.js";
import { mtype } from "./minions.js";
import { famFx } from "./paths.js";
import { structFeatureMult } from "./world.js";
import { D, ageY, isAdult, living } from "./state.js";
import { ES, activeSynergies, baseId, classSynMult, pieceDef, pieceTier, scaledPiece } from "./estate.js";

// cooked food quality: station tier and the best cook's skill
export function foodQualityOf(s, p) {
  const q = ES().foodQuality || { perTier: 0, perCookLvl: 0, skill: "cooking" };
  const out = ((p.bonus && p.bonus.processes) || [{}])[0].out;
  return 1 + pieceTier(p.id) * q.perTier + operatorLvl(s, q.skill) * q.perCookLvl + famFx(s, "foodQ", out);
}

export function blendFoodQ(s, res, n, q) {
  if (!s.foodQ) s.foodQ = {};
  const have = Math.max(0, s.res[res] || 0);
  const old = s.foodQ[res] || 1;
  s.foodQ[res] = (old * have + q * n) / Math.max(1e-9, have + n);
}

export function operatorLvl(s, skill) {
  if (!skill) return 0;
  const sp = ES().skillProcess;
  let b = 0;
  for (const m of living(s)) if (isAdult(m) || ageY(m) >= 12) b = Math.max(b, m.skills[skill]?.lvl || 0);
  for (const mi of s.minions || [])
    if (mi.job === "craft") b = Math.max(b, (mtype(mi.type).apt.craft || 1) * sp.minionLvlPerApt);
  return b;
}

export const skillSpeed = (s, p) => 1 + ES().skillProcess.speedPerLvl * operatorLvl(s, p && p.skill);

export const skillYield = (s, p) => 1 + ES().skillProcess.yieldPerLvl * operatorLvl(s, p && p.skill);

export const resTier = k => +(Object.entries(ES().resourceTiers).find(([, t]) => t.res.includes(k)) || [0])[0];

export const DEFAULT_RESERVE = {
  wood: 50,
  stone: 50,
  ore: 0,
  copperore: 0,
  hides: 0,
  thyme: 0,
  wheat: 0,
  barley: 0,
  milk: 0,
  meat: 0,
  vegetables: 0,
};

export const reserveOf = (s, k) => (s.reserve || {})[k] || 0;

export function setReserve(s, k, n) {
  if (!(k in DEFAULT_RESERVE)) return false;
  s.reserve[k] = Math.max(0, Math.floor(+n || 0));
  return true;
}

export const pkey = (uid, id) => uid + ":" + baseId(id);

export const isPaused = (s, uid, id) => (s.paused || []).includes(pkey(uid, id));

export function togglePiece(s, uid, id) {
  const k = pkey(uid, id);
  const i = s.paused.indexOf(k);
  if (i >= 0) s.paused.splice(i, 1);
  else s.paused.push(k);
  return i < 0;
}

// Quality flows down food chains: farmers raise crop quality, inputs carry theirs into the dish.
export const Q_MAX = 2.5;
export const isIngredient = k => k in (ES().meals?.menu || {}) || (ES().cropQuality?.res || []).includes(k) || k === "flour";
export function inputQuality(s, inp) {
  let w = 0,
    q = 0;
  for (const [k, v] of Object.entries(inp || {}))
    if (isIngredient(k)) {
      w += v;
      q += v * ((s.foodQ || {})[k] || 1);
    }
  return w ? q / w : 1;
}
function cropQ(s, p, pr) {
  const c = ES().cropQuality;
  if (!c || Object.keys(pr.in || {}).length || !c.res.includes(pr.out)) return 0;
  return 1 + operatorLvl(s, c.skill) * c.perLvl + famFx(s, "cropQ", pr.out);
}

export function processDay(s, mul = 1) {
  for (const st of s.structures || []) {
    const syn = activeSynergies(st);
    for (const p of st.pieces.filter(id => !isPaused(s, st.uid, id)).map(id => scaledPiece(st, id)))
      for (const pr0 of (p && p.bonus.processes) || []) {
        const pr = { ...pr0, rate: pr0.rate * skillSpeed(s, p) * classSynMult(s, st) };
        const yl = skillYield(s, p);
        let n = pr.rate * mul * syn.reduce((a, y) => a * ((y.bonus.processMult || {})[pr.out] || 1), 1);
        for (const [k, v] of Object.entries(pr.in)) n = Math.min(n, Math.max(0, (s.res[k] || 0) - reserveOf(s, k)) / v);
        if (n <= 0) continue;
        const inQ = inputQuality(s, pr.in);
        for (const [k, v] of Object.entries(pr.in)) s.res[k] -= v * n;
        const made = n * yl * (1 + famFx(s, "yield", pr.out)) * (D.world ? structFeatureMult(s, st.type) : 1) * resGain(s) * (pr.in && Object.keys(pr.in).length ? 1 : seasonYield(s, pr.out));
        const cq = cropQ(s, p, pr);
        if (pr.food) blendFoodQ(s, pr.out, made, Math.min(Q_MAX, foodQualityOf(s, p) * inQ));
        else if (cq) blendFoodQ(s, pr.out, made, cq);
        else if (inQ !== 1 && isIngredient(pr.out)) blendFoodQ(s, pr.out, made, inQ);
        s.res[pr.out] = (s.res[pr.out] || 0) + made;
      }
  }
}

export const processRates = (s, st, pid) =>
  (scaledPiece(st, pid).bonus.processes || []).map(pr => ({
    out: pr.out,
    rate:
      Math.round(
        pr.rate *
          skillSpeed(s, pieceDef(pid)) *
          skillYield(s, pieceDef(pid)) *
          activeSynergies(st).reduce((a, y) => a * ((y.bonus.processMult || {})[pr.out] || 1), 1) *
          100,
      ) / 100,
  }));

export const processRate = (s, st, pid) => {
  const r = processRates(s, st, pid);
  return r.length ? r[0].rate : 0;
};

