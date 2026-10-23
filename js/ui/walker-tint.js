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
