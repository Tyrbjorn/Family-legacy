// Pure data expansion (no imports): every metals.json template × metal becomes an item and a recipe,
// unless a hand-made one already exists (those keep their own stats and class/path fields).
export function expandMetals(d) {
  const M = d.metals;
  if (!M || !d.items || !d.crafting || d._metalsExpanded) return;
  d._metalsExpanded = true;
  const items = new Set(d.items.map(i => i.id)),
    bases = new Set(d.crafting.recipes.map(r => r.base));
  for (const t of M.templates)
    for (const mid of t.metals) {
      const m = M.metals[mid],
        id = `${mid}_${t.id}`;
      if (!items.has(id))
        d.items.push({ id, name: `${m.name} ${t.name}`, slot: t.slot, rarity: m.rarity, cp: Math.round(t.cp * m.cp), value: Math.round(t.value * m.value), metal: mid, gen: true });
      if (!bases.has(id))
        d.crafting.recipes.push({
          id: `r_${id}`,
          name: `${m.name} ${t.name}`,
          base: id,
          skill: t.skill,
          station: t.station,
          mats: { [m.res]: t.metal, ...t.mats },
          days: t.days + (m.tier || 0),
          ...(t.minSkill || m.tier ? { minSkill: (t.minSkill || 0) + (m.tier || 0) * 10 } : {}),
          ...(t.line ? { line: t.line } : {}),
          ...(t.path ? { path: t.path } : {}),
          metal: mid,
          gen: true,
        });
    }
}
