import { injure, permFx } from "./injuries.js";
// Turn-based combat: each fighter has HP and Morale. Every round each standing fighter trades a blow with a random
// foe; who lands it is rolled from the power ratio. Losing HP drains morale; below fleeAt a fighter rolls to flee
// (game difficulty adjusts that roll); a group (2+) whose average morale is below fleeAt flees as one. Numbers: tuning.combat.
import { T, log, rng } from "./state.js";
import { actLvl, chalFx, enemyCp, gameFx } from "./difficulty.js";
import { cp, level } from "./family.js";
import { morale } from "./food.js";
import { minionPower } from "./minions.js";

const C = () => T.combat;
const SK = () => C().skills;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// a fighter: o.m = family member (challenge, log name), o.skills = { skillId: lvl }, o.leader
export const fighter = (name, pow, o = {}) => ({ name, pow, max: o.hp || 100, hp: o.hpNow ?? o.hp ?? 100, mor: o.mor ?? 100, skills: o.skills || {}, m: o.m || null, leader: !!o.leader, out: null });
const up = side => side.filter(f => !f.out);
const avg = side => (up(side).length ? up(side).reduce((a, f) => a + f.mor, 0) / up(side).length : 0);
const best = (side, sk) => Math.max(0, ...side.map(f => f.skills[sk] || 0));
const shake = (side, n) => up(side).forEach(f => (f.mor -= n));
export const landChance = (a, b) => clamp(0.5 + C().slope * ((a + 20) / (b + 20) - 1), 0.03, 0.97);

// one exchange, always rolled from our side's view so odds match the old success formula
function blow(att, tgt, side) {
  const [a, b] = side.includes(att) ? [att, tgt] : [tgt, att];
  const [w, l] = rng() < landChance(a.pow, b.pow) ? [a, b] : [b, a];
  const d = C().dmg * (0.75 + 0.5 * rng()) * (1 + chalFx(w.m, "roll")) * l.max;
  l.hp -= d;
  const hold = side.includes(l) && best(side, SK().hold.skill) ? 1 - SK().hold.v : 1;
  l.mor -= ((C().morPerHp * d) / l.max) * hold;
}
function fall(f, mine) {
  shake(mine, f.leader ? C().leaderLost : C().allyLost);
}

// A = our side, B = foes. o.lvl = difficulty snapshot, o.monsters = foes are monsters. Returns { result, rounds }:
// win | fled (our side ran) | defeat (our side all down) | withdraw (no one broke in maxRounds)
export function fight(s, A, B, o = {}) {
  const fleeP = C().fleeBase + gameFx(s, "flee", o.lvl);
  const eye = Math.max(0, ...A.map(f => permFx(f.m, "shout"))); // Lost Eye: a fearsome glare
  if (best(A, SK().shout.skill) || eye) shake(B, (best(A, SK().shout.skill) ? SK().shout.v + best(A, SK().shout.skill) / 5 : 0) + eye);
  if (o.monsters && best(A, SK().foe.skill)) shake(B, SK().foe.v);
  let rallied = false,
    dressed = false;
  for (let rd = 1; rd <= C().maxRounds; rd++) {
    for (const f of [...up(A), ...up(B)]) {
      const foes = up(A.includes(f) ? B : A);
      if (f.out || !foes.length) continue;
      const t = foes[Math.floor(rng() * foes.length)];
      blow(f, t, A);
      for (const x of [f, t]) if (x.hp <= 0 && !x.out) (x.out = "down"), fall(x, A.includes(x) ? A : B);
    }
    const lv = best(A, SK().dress.skill), hurt = up(A).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (lv && !dressed && hurt && hurt.hp / hurt.max < SK().dress.at) (hurt.hp += SK().dress.v * hurt.max), (dressed = true);
    const rl = best(A, SK().rally.skill);
    if (rl && !rallied && up(A).length && avg(A) < SK().rally.at) shake(A, -(SK().rally.v + rl / 5)), (rallied = true);
    for (const [side, p] of [[A, fleeP], [B, C().fleeBase]]) {
      for (const f of up(side)) if (f.mor < C().fleeAt && rng() < p) (f.out = "fled"), shake(side, C().allyLost);
      if (side.length > 1 && up(side).length && avg(side) < C().fleeAt) up(side).forEach(f => (f.out = "fled")); // groups only; a lone fighter rolls
    }
    if (!up(B).length) return { result: "win", rounds: rd };
    if (!up(A).length) return { result: A.some(f => f.out === "fled") ? "fled" : "defeat", rounds: rd };
  }
  return { result: "withdraw", rounds: C().maxRounds };
}
export const fightWord = r => ({ win: "won", fled: "fled", defeat: "was beaten", withdraw: "withdrew" })[r.result] + ` after round ${r.rounds}`;

// ---- dungeons as event sequences: tier by the first floor's power; 2·tier+2 events alternating fights and
// stat checks (ending on a fight), spread over the floors. Optional dg.events replaces the sequence; dg.story
// [{at, text, check?}] inserts story beats; dg.onClear {unlock, text} fires on a full clear.
export const dungeonTier = dg => 1 + C().dungeon.tierAt.filter(x => dg.floors[0].cp >= x).length;
export function dungeonEvents(dg) {
  if (dg.events) return dg.events;
  const t = dungeonTier(dg), n = 2 * t + 2, F = dg.floors.length, pool = C().dungeon.checks;
  const ev = Array.from({ length: n }, (_, k) => {
    const floor = Math.floor((k * F) / n);
    return (n - 1 - k) % 2 === 0 ? { kind: "fight", floor, cp: dg.floors[floor].cp } : { kind: "check", floor, ...pool[(k + dg.id.length) % pool.length], dc: C().dungeon.checkDc[t] };
  });
  // packs: fights before a floor's last fight are weaker
  ev.forEach((e, j) => e.kind === "fight" && ev.slice(j + 1).some(x => x.kind === "fight" && x.floor === e.floor) && (e.cp *= C().dungeon.packCp));
  for (const st of dg.story || []) ev.splice(Math.min(st.at, ev.length), 0, { kind: "story", floor: ev[Math.min(st.at, ev.length - 1)].floor, ...st });
  return ev;
}
const checkOk = (m, c) => !c || rng() < clamp(0.5 + ((c.stat ? m.stats[c.stat] || 0 : (m.skills[c.skill] || { lvl: 0 }).lvl) - (c.dc || 0)) * 0.08, 0.1, 0.95);

// the family member as a fighter; run = { hp, mor } carried through a dungeon run
const MSK = () => Object.values(SK()).map(x => x.skill);
export function memberFighter(s, m, run) {
  const max = Math.round((50 + 2 * (m.stats.VIT || 0) + 2 * level(m)) * (1 + permFx(m, "hp"))),
    mor0 = 100 + clamp(morale(s), -10, 10) + Math.min(C().guardMoraleMax, minionPower(s, "guard") * C().guardMorale) + permFx(m, "mor");
  const skills = Object.fromEntries(MSK().map(k => [k, (m.skills[k] || { lvl: 0 }).lvl]));
  return fighter(m.name, cp(s, m) * (1 + permFx(m, "pow")), { m, skills, leader: true, hp: max, hpNow: run ? run.hp : max, mor: run ? run.mor : mor0 });
}
// one dungeon floor's events; false = the run ends here (logged with the round it ended)
export function dungeonFloorRun(s, m, dg, i, t) {
  const me = memberFighter(s, m, t.run);
  t.run = t.run || { hp: me.hp, mor: me.mor, start: me.mor };
  const end = msg => {
    log(s, `❌ ${m.name} ${msg} in ${dg.name} (floor ${i + 1}/${dg.floors.length}).`);
    hurt(s, m, t.run, me.out === "down");
    return false;
  };
  for (const ev of dungeonEvents(dg).filter(e => e.floor === i)) {
    if (ev.kind === "story") {
      if (ev.text) log(s, `📜 ${dg.name}: ${ev.text}`);
      if (ev.check && !checkOk(m, ev.check)) me.hp -= C().dungeon.checkFail * me.max;
    } else if (ev.kind === "check") {
      if (!checkOk(m, ev)) (me.hp -= C().dungeon.checkFail * me.max), (me.mor -= C().morPerHp * C().dungeon.checkFail);
      if (me.hp <= 0) return (me.out = "down"), end(`collapsed at ${ev.text || "a trap"}`);
    } else {
      const r = fight(s, [me], [fighter(dg.name, enemyCp(s, m, ev.cp))], { lvl: actLvl(s, m), monsters: true });
      if (r.result !== "win") return end(fightWord(r));
      me.mor = Math.min(t.run.start, me.mor + C().between);
      me.hp = Math.min(me.max, me.hp + C().betweenHp * me.max);
    }
    t.run.hp = me.hp;
    t.run.mor = me.mor;
  }
  return true;
}
// injuries come from HP: beaten = full injury; ending a fight or run badly hurt = a light one. Fleeing itself costs nothing.
export function hurt(s, m, run, beaten) {
  const max = 50 + 2 * (m.stats.VIT || 0) + 2 * level(m);
  const dressing = (m.skills.healing || { lvl: 0 }).lvl > 0; // Field Dressing
  if (beaten) injure(s, m, 2, "in a fight", { guards: minionPower(s, "guard") > 0, dressing });
  else if (run && run.hp / max < C().injuryBelow) injure(s, m, 1, "after a hard fight", { treated: dressing });
}
