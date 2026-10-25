// R77: the live fl_ui_v1 record for this page (import this from UI code; tests use ui-store.js directly).
import { loadUi, saveUi, resetSlot, slotRec } from "./ui-store.js";
const st = (() => { try { return localStorage; } catch (e) { return { getItem() { throw new Error("no storage"); }, setItem() { throw new Error("no storage"); } }; } })();
const L = loadUi(st);
export const UI = L.ui;
export const uiOk = () => L.ok;
export const uiSave = () => { L.ok = saveUi(st, UI) && L.ok; return L.ok; };
export const uiResetSlot = n => { resetSlot(UI, n); uiSave(); };
export const uiSlot = (n, key, make) => slotRec(UI, n, key, make);
