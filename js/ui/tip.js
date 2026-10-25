// R76 tip jar: a single link, shown only on the web demo (edition "demo" + target "web", from data/build.json).
// tools/make-release.mjs removes tipUrl from every other build (Play / Steam / full), so the link cannot appear there even if this file is kept.
const esc = x => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function tipOn(b = {}) { return b.target === "web" && b.edition === "demo" && /^https?:\/\//.test(b.tipUrl || ""); }
// `url` still holds the placeholder until Jeremy has a real page: the visible text says so
export const tipLink = (b = {}, label = "☕ Tip jar") => tipOn(b)
  ? `<a class="tipjar" href="${esc(b.tipUrl)}" target="_blank" rel="noopener noreferrer">${label}${/example\.com|placeholder/i.test(b.tipUrl) ? " [placeholder link]" : ""}</a>`
  : "";
