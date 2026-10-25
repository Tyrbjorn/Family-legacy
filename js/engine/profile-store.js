// R76 profile (per device, not per save) storage helpers. Pure functions over a Storage-like object (localStorage / a Map shim).
//   fl_settings_v1 -> { v:1, classic:bool, motion:"auto"|"on"|"off", skipTitle:bool }
//   fl_enc_v1      -> encyclopedia discovery memory (see enc.js)
// The save format is untouched: s.classicEmoji is still written into saves (mirrored from the profile) so old builds and FL1: codes keep working.
export const SETTINGS_KEY = "fl_settings_v1";
export const ENC_KEY = "fl_enc_v1";
export const MOTION = ["auto", "on", "off"];
export const defaultSettings = () => ({ v: 1, classic: false, motion: "auto", skipTitle: false });

const clean = o => {
  const d = defaultSettings(), r = o && typeof o === "object" ? o : {};
  return { v: 1, classic: !!r.classic, motion: MOTION.includes(r.motion) ? r.motion : d.motion, skipTitle: !!r.skipTitle };
};
// Load the profile settings. First run (no record): classic emoji starts from the value of the save that was open (`legacyClassic`, the
// last played slot's s.classicEmoji) so nobody's current look changes; everything else uses the defaults. Returns { settings, migrated }.
export function loadSettings(st, legacyClassic = false) {
  let raw = null;
  try { raw = JSON.parse(st.getItem(SETTINGS_KEY) || "null"); } catch (e) { raw = null; }
  if (raw && typeof raw === "object") return { settings: clean(raw), migrated: false };
  const settings = { ...defaultSettings(), classic: !!legacyClassic };
  try { st.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage short: still works for this session */ }
  return { settings, migrated: true };
}
export function saveSettings(st, settings) {
  const v = clean(settings);
  try { st.setItem(SETTINGS_KEY, JSON.stringify(v)); return true; } catch (e) { return false; }
}
// is reduced motion on? "on"/"off" force it, "auto" follows the device (prefers-reduced-motion)
export const reducedMotion = (settings, deviceReduced) => settings.motion === "on" ? true : settings.motion === "off" ? false : !!deviceReduced;
