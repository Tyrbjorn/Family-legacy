// R76: reduced motion is a profile setting. "auto" follows the device (prefers-reduced-motion), "on"/"off" force it.
// Result: class "rm" on <html> (CSS) and reduced() for the canvas / rAF code.
import { reducedMotion } from "../engine/profile-store.js";
let mode = "auto";
const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const apply = () => typeof document !== "undefined" && document.documentElement.classList.toggle("rm", reducedMotion({ motion: mode }, mq && mq.matches));
if (mq && mq.addEventListener) mq.addEventListener("change", apply);
export function setMotion(m) { mode = m; apply(); }
export const reduced = () => typeof document !== "undefined" && document.documentElement.classList.contains("rm");
