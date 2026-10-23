// R58 ART-1: the art renderer (fl-r58-art1-proposal.md). Game-agnostic: give it the art table (data/art.json),
// an entry and its emoji, and it returns an <img> when there is art, otherwise the emoji. Greyscale sprites are
// tinted by material with a CSS multiply layer masked to the sprite (no canvas, so it is cheap and testable).
// Lists and cards only; logs and buttons keep emoji.
export function spriteFor(A, kind, id, def) {
  if (!A || !id) return null;
  if (kind === "res") return (A.res || {})[id] || null;
  if (kind === "ui") return (A.ui || {})[id] || null;
  const base = String(id).split("+")[0].split("#")[0];
  return (def && def.sprite) || (A.items || {})[base] || (def && (A.types || {})[def.type]) || null;
}
export function matFor(A, id, def) {
  const base = String(id || "").split("+")[0].split("#")[0];
  return (def && def.mat) || ((A && A.itemMat) || {})[base] || null;
}
const esc = t => String(t).replace(/"/g, "&quot;");
// opts: { classic, emoji, size (px, default 18), title }
export function iconHtml(A, kind, id, def, opts = {}) {
  const emoji = opts.emoji ?? (def && def.icon) ?? "";
  const key = !opts.classic && spriteFor(A, kind, id, def), sp = key && (A.sprites || {})[key];
  if (!sp) return emoji;
  const px = opts.size || 18, src = sp.file, t = opts.title ? ` title="${esc(opts.title)}"` : "";
  const fb = `this.parentNode.outerHTML='${String(emoji).replace(/'/g, "")}'`;
  // R58b: ores and smelted metals share the ingot sprite, recoloured by metal (resMat)
  // R65: resTint = palette per resource for batch4 sprites (same tint path as resMat)
  const rmat = kind === "res" && ((A.resMat || {})[id] || (A.resTint || {})[id]);
  const P = A.palettes || {}, pal = (sp.grey || rmat) && P[rmat || matFor(A, id, def)];
  const tintSpan = (c, f) => `<span class="arttint" style="background:${c};-webkit-mask-image:url(${f});mask-image:url(${f})"></span>`;
  const img = `<img src="${src}"${rmat && !sp.grey && !sp.layer2 ? ' style="filter:grayscale(1) brightness(1.15)"' : ""} alt="${esc(emoji)}" loading="lazy" onerror="${fb}">`;
  const wrap = inner => `<span class="art" style="width:${px}px;height:${px}px"${t}>${inner}</span>`;
  // R58.2: ore = neutral rock + metal-tinted veins layer (same masked multiply tint as weapons)
  if (sp.veins) {
    const vc = ((A.veinPal || {})[rmat]) || (pal && pal.base), v = sp.veins;
    return wrap(`<img src="${src}" alt="${esc(emoji)}" loading="lazy" onerror="${fb}"><img class="artvein" src="${v}" alt="" loading="lazy" onerror="this.remove()">${vc ? tintSpan(vc, v) : ""}`);
  }
  // R65: layer2 = list of {file, tint}, drawn in order over the base. tint:true takes the resource palette, false stays as drawn.
  if (sp.layer2) {
    const L = [].concat(sp.layer2).map(l => (typeof l === "string" ? { file: l, tint: true } : l));
    const bp = sp.basePal ? P[sp.basePal] : sp.grey && pal;
    let h = img + (bp ? tintSpan(bp.base, src) : "");
    for (const l of L) h += `<img class="artlayer" src="${l.file}" alt="" loading="lazy" onerror="this.remove()">${l.tint && pal ? tintSpan(pal.base, l.file) : ""}`;
    return wrap(h);
  }
  return wrap(img + (pal ? tintSpan(pal.base, src) : ""));
}
