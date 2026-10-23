// R59 ART-2: paper-doll renderer (fl-r59-character-creation-proposal.md). Same idea as js/art.js: stacked <i> layers,
// greyscale layers tinted with a CSS multiply masked to the layer (no canvas). Layer order (batch2b index.md):
// base → skin → sea-touched marks → sea-touched eyes → tabard → armour → hair (×(1−coifmask) under chain/plate) → bun → beard → beard rings.
// Skin/hair/tabard/marks: rgb = grey/216 × colour (the layer is brightened by 255/216, then multiplied by the colour).
const GAIN = "filter:brightness(1.18)";
const url = u => `url(${u})`;
const lay = (src, extra = "") => `<i style="background-image:${url(src)};${extra}"></i>`;
const tint = (src, col, mask2) =>
  mask2
    ? `<i class="dt" style="background:${col};-webkit-mask-image:${url(src)},${url(mask2)};-webkit-mask-composite:source-out;mask-image:${url(src)},${url(mask2)};mask-composite:subtract"></i>`
    : `<i class="dt" style="background:${col};-webkit-mask-image:${url(src)};mask-image:${url(src)}"></i>`;
// ordered layer list (pure: tested in r59): [{k, src, col?, gain?, minus?}]
export function dollLayers(DL, CR, o) {
  const b = DL && DL.bases && DL.bases[o.base];
  if (!b || !b.base) return [];
  const L = o.look || {}, out = [];
  const skin = ((CR.skins || [])[L.skin | 0] || {}).col || "#D9A97E";
  const hairC = o.elder ? CR.elderHair || "#c9c5bf" : ((CR.hairCols || [])[L.hairCol | 0] || {}).col || "#5a3a24";
  out.push({ k: "base", src: b.base });
  if (b.skin) out.push({ k: "skin", src: b.skin, col: skin, gain: 1 });
  if (o.sea && b.marks) out.push({ k: "marks", src: b.marks, col: skin, gain: 1 });
  if (o.sea && b.eyes) out.push({ k: "eyes", src: b.eyes });
  // R59b: the house tabard sits over body armour (clothes/leather/chain) so the colour reads; plate goes over it
  const ar = o.armor && b.armor && b.armor[o.armor], plate = /plate/.test(o.armor || "");
  const tab = b.tabard && o.house ? { k: "tabard", src: b.tabard, col: o.house, gain: 1 } : null;
  if (tab && plate) out.push(tab);
  if (ar) out.push({ k: "armor", src: ar, col: o.armorCol || null });
  if (tab && !plate) out.push(tab);
  const coif = ar && b.coif && b.coif[o.armor];
  const hs = b.hair && b.hair[L.hair] ? L.hair : Object.keys(b.hair || {})[0];
  if (hs) out.push({ k: "hair", src: b.hair[hs], col: hairC, gain: 1, minus: coif || null });
  if (L.bun && b.bun) out.push({ k: "bun", src: b.bun, col: hairC, gain: 1, minus: coif || null });
  if (L.beard && b.beard && b.beard[L.beard]) {
    out.push({ k: "beard", src: b.beard[L.beard], col: hairC, gain: 1 });
    if (b.rings && b.rings[L.beard]) out.push({ k: "rings", src: b.rings[L.beard] });
  }
  return out;
}
// o: {base, look, sea, house, armor, armorCol, elder, emoji, classic, size, crop:"portrait"|"full", frame}
export function dollHtml(DL, CR, o) {
  const ls = !o.classic && dollLayers(DL, CR, o);
  if (!ls || !ls.length) return `<span class="dollemo" style="font-size:${Math.round((o.size || 48) * 0.6)}px">${o.emoji || "🧑"}</span>`;
  const b = DL.bases[o.base], W = DL.w || 144, H = DL.h || 352, sz = o.size || 48;
  const inner = ls
    .map(l => (l.col ? lay(l.src, (l.gain ? GAIN : "") + (l.minus ? `;-webkit-mask-image:${url(l.src)},${url(l.minus)};-webkit-mask-composite:source-out;mask-image:${url(l.src)},${url(l.minus)};mask-composite:subtract` : "")) + tint(l.src, l.col, l.minus) : lay(l.src)))
    .join("");
  const t = o.title ? ` title="${String(o.title).replace(/"/g, "&quot;")}"` : "";
  if (o.crop === "full") {
    const k = sz / H;
    return `<span class="doll" style="width:${Math.round(W * k)}px;height:${sz}px"${t}><span class="dollin" style="width:${W}px;height:${H}px;transform:scale(${k})">${inner}</span></span>`;
  }
  const [px, py0, S] = b.pb || [0, 0, W], py = Math.max(0, py0 - Math.round(S * 0.08)), k = sz / S;
  const fr = o.frame && DL.frames && DL.frames[o.frame] && (DL.frames[o.frame][sz] || DL.frames[o.frame][sz >= 72 ? 96 : sz >= 40 ? 48 : 32]);
  return `<span class="doll port" style="width:${sz}px;height:${sz}px"${t}><span class="dollin" style="width:${W}px;height:${H}px;transform:scale(${k}) translate(${-px}px,${-py}px)">${inner}</span>${fr ? `<img class="dollfr" src="${fr}" alt="" onerror="this.remove()">` : ""}</span>`;
}
