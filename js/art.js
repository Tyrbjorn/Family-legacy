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
  const rmat = kind === "res" && (A.resMat || {})[id];
  const pal = (sp.grey || rmat) && (A.palettes || {})[rmat || matFor(A, id, def)];
  // R58.2: ore = neutral rock + metal-tinted veins layer (same masked multiply tint as weapons)
  if (sp.veins) {
    const vc = ((A.veinPal || {})[rmat]) || (pal && pal.base), v = sp.veins;
    const vt = vc ? `<span class="arttint" style="background:${vc};-webkit-mask-image:url(${v});mask-image:url(${v})"></span>` : "";
    return `<span class="art" style="width:${px}px;height:${px}px"${t}><img src="${src}" alt="${esc(emoji)}" loading="lazy" onerror="${fb}"><img class="artvein" src="${v}" alt="" loading="lazy" onerror="this.remove()">${vt}</span>`;
  }
  const tint = pal ? `<span class="arttint" style="background:${pal.base};-webkit-mask-image:url(${src});mask-image:url(${src})"></span>` : "";
  return `<span class="art" style="width:${px}px;height:${px}px"${t}><img src="${src}"${rmat && !sp.grey ? ' style="filter:grayscale(1) brightness(1.15)"' : ""} alt="${esc(emoji)}" loading="lazy" onerror="${fb}">${tint}</span>`;
}
