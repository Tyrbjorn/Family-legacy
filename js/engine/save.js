import { applyAutoDefaults } from "./legacy.js";
import { DEFAULT_RESERVE } from "./production.js";
import { startTutorial } from "./tutorial.js";
import { newMember } from "./family.js";
import { D, SAVE_VERSION, log } from "./state.js";
import { STEPS } from "./save-steps.js";
import { hasBoat, setBoatAccess } from "./world.js";
export { renameIds } from "./save-steps.js";

export function newGame(now = Date.now()) {
  const _s = _newGame(now);
  _s.land = [];
  _s.structures = [];
  _s.pieceStore = [];
  normalize(_s);
  applyAutoDefaults(_s); // R37: free automation on, except autoDefaults.off
  startTutorial(_s);
  return _s;
}

export function _newGame(now) {
  const s = {
    v: SAVE_VERSION,
    day: 0,
    nextId: 1,
    members: [],
    activeId: 1,
    head: 1,
    res: { coin: 50, food: 60, wood: 0, stone: 0, thyme: 0 },
    ration: "normal",
    morale: 0,
    diet: {},
    revealed: [],
    buildings: {},
    furniture: [],
    vault: [], // R30: no armor; clothes + cloak + Orrin's blade are equipped at the tutorial start (data/tutorial.json start.equip)
    log: [],
    turbo: { charge: 0, on: false },
    lastSave: now,
    cleared: [],
    explored: [],
    discovered: [],
    found: [],
    reserve: { ...DEFAULT_RESERVE },
    paused: [],
    forSale: [],
    saleProg: 0,
    unlocks: [],
    doneQuests: [],
    specialGranted: [],
    minions: [],
    repLevel: 0,
    gameOver: false,
    suitors: [],
    houses: {},
    weary: 0,
    renown: 0,
    deeds: [],
    acc: 0,
    pendingClass: [],
  };
  for (const b of D.buildings) s.buildings[b.id] = b.start;
  const f = newMember(s, { age: D.tuning.founderAge ?? 15 });
  s.members.push(f);
  f.action = { type: "activity", target: "fishing", progress: 0 };
  log(s, `🏡 ${f.name} founds the family estate.`);
  return s;
}

export function serialize(s, now = Date.now()) {
  s.lastSave = now;
  return JSON.stringify(s);
}

export function deserialize(str) {
  const s = JSON.parse(str);
  if (!s || s.v !== SAVE_VERSION) throw new Error("bad save version");
  return s;
}

export const SCHEMA = Math.max(...STEPS.map(x => x.n));
export const migrationSteps = () => STEPS.map(({ n, once, name }) => ({ n, once: !!once, name }));

export function normalize(s) {
  const from = s.schema || 0;
  for (const st of STEPS) if (!(st.once && from >= st.n)) st.run(s);
  s.schema = SCHEMA;
  if (D.world) setBoatAccess(hasBoat(s));
  s._norm = true;
}
