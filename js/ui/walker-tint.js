// R64: map walkers are tiny, so the true house colour reads almost black. Walkers alone use a lifted tint:
// same hue and saturation, lightness raised to at least 0.42 (max 0.6), plus a 1px highlight row (+0.14) on
// the top edge of the tabard. The doll/portrait keeps the exact chosen colour.
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function rgb2hsl([r, g, b]) {
  (r /= 255), (g /= 255), (b /= 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb([h, s, l]) {
  if (!s) return [l, l, l].map(v => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
export function walkerTabard(hex) {
  const [h, s, l] = rgb2hsl(hex2rgb(hex));
  const L = Math.min(0.6, Math.max(0.42, l * 1.5));
  return { base: hsl2rgb([h, s, L]), hi: hsl2rgb([h, s, Math.min(0.8, L + 0.14)]), orig: hex2rgb(hex) };
}

// R74: the tinted copy of a loaded walker sheet (tabard key #194261 -> the lifted house colour, hair keys #AAACB2 / #84868C -> hair colour).
// Moved here from estate-map.js so the roof-off room workers use the very same pixels as the map walkers. Needs a DOM canvas.
export function tintSheet(src, house, hair) {
  const c = document.createElement("canvas"); c.width = src.naturalWidth; c.height = src.naturalHeight;
  const g = c.getContext("2d"); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const T = walkerTabard(house), HC = rgb(hair), RW = c.width * 4;
  const isTab = j => j >= 0 && p[j + 3] && p[j] === 25 && p[j + 1] === 66 && p[j + 2] === 97;
  const top = new Set(); // R64: tabard pixels with no tabard above get the 1px highlight
  for (let i = 0; i < p.length; i += 4) if (isTab(i) && !isTab(i - RW)) top.add(i);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    if (r === 25 && gg === 66 && b === 97) { const H = top.has(i) ? T.hi : T.base; (p[i] = H[0]), (p[i + 1] = H[1]), (p[i + 2] = H[2]); } // tabard key #194261 idx 22, lifted for walkers (R64)
    else if ((r === 170 && gg === 172 && b === 178) || (r === 132 && gg === 134 && b === 140)) { const f = r / 216; p[i] = Math.min(255, HC[0] * f); p[i + 1] = Math.min(255, HC[1] * f); p[i + 2] = Math.min(255, HC[2] * f); } // hair keys
  }
  g.putImageData(d, 0, 0);
  return c;
}
