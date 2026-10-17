// Pure data derivation (no imports): item stats from type × material × grade (data/gear.json "kinds").
// Weapons: hit = atk × mat.str × g, weight = wt × mat.wt, swings/s = base / (1 + perWt × weight), cp = DPS.
// Armor: defense = def × str × g (+ dodge from its armor class, + caster spell for robes); shields: defense; focus/quiver/kit: pow × g.
// Unarmored clothes/robes: defense stays near zero (g only scales a robe's caster spell).
export function baseStats(K, it, q = 1) {
  const t = K && K.types[it.type];
  if (!t) return null;
  const m = K.mats[it.mat] || { str: 1, wt: 1 },
    g = (it.g || 1) * q,
    ac = K.armorClasses[t.fam],
    o = { type: it.type, tname: t.name, fam: t.fam, slot: t.slot, hands: t.hands || 1, blocks: t.blocks || [], wt: +(t.wt * m.wt).toFixed(2), mat: it.mat || null };
  if (t.atk) {
    o.hit = t.atk * m.str * g;
    o.spd = K.speed.base / (1 + K.speed.perWt * o.wt);
    o.dps = o.hit * o.spd;
    o.pierce = (t.pierce || 0) + (m.pierce || 0);
    if (t.crit) o.crit = t.crit;
    if (t.ranged) o.ranged = true;
    if (m.bane) o.bane = m.bane;
    if (m.caster && t.fam === "arcane") o.caster = m.caster; // elderwood/rowan staves and wands: caster bonus
    o.cp = o.dps;
  } else if (t.pow) o.cp = o.pow = t.pow * g;
  else if (ac) {
    const un = t.fam === "unarmored";
    o.cls = t.fam;
    o.def = t.def * m.str * (un ? q : g);
    o.dodge = ac.dodge;
    o.spell = t.spell ? t.spell * g : 0;
    o.spellFail = ac.spellFail * (it.mat === "mithril" ? K.spellFail.mithril : 1);
    o.cp = o.def + o.dodge * K.dodge.cpPer + o.spell;
  } else {
    o.def = t.def * m.str * g;
    o.cp = o.def;
  }
  return o;
}
// at load: every typed item gets its cp from its stats (after metals.json templates are expanded)
export function deriveGear(d) {
  const K = d.gear && d.gear.kinds;
  if (!K || !d.items || d._gearDerived) return;
  d._gearDerived = true;
  for (const it of d.items) {
    const b = baseStats(K, it);
    if (b) it.cp = Math.max(1, Math.round(b.cp));
  }
}
