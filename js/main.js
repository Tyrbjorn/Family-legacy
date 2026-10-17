import { runAction } from "./ui/handlers/index.js";
import "./ui/feedback.js";
import * as E from "./engine.js";
import { U } from "./ui/state.js";
import { groupOf, render } from "./ui/render.js";

const KEY = "familyLegacy.save.v1";

const names = [
  "skills",
  "classes",
  "traits",
  "buildings",
  "furniture",
  "items",
  "quests",
  "regions",
  "tuning",
  "nodes",
  "towns",
  "minions",
  "guilds",
  "jobs",
  "activities",
  "estate",
  "crafting",
  "map",
  "dungeons",
  "legacy",
  "chronicle",
  "achievements",
  "events",
  "encounters",
  "seasons",
  "tutorial",
  "notify",
  "marriage",
  "phases",
  "intros",
  "gear",
  "paths",
  "world",
  "metals",
  "endgame",
];

export const D = {};

await Promise.all(names.map(async n => (D[n] = await (await fetch(`data/${n}.json`)).json())));
await Promise.all(D.estate.structureFiles.map(async f => (D["structures/" + f] = await (await fetch(`data/structures/${f}.json`)).json())));

E.setData(D);

// Dev Mode lives in its own localStorage key (never in saves/exports). ?dev=1 reveals + enables, ?dev=0 disables.
const DEV_KEY = "fl-dev";
{
  const q = new URLSearchParams(location.search).get("dev");
  if (q === "1") localStorage.setItem(DEV_KEY, "1");
  if (q === "0") localStorage.removeItem(DEV_KEY);
  E.setDevMode(localStorage.getItem(DEV_KEY) === "1");
  if (q === "1") U.devRevealed = true;
}

export let s,
  sheetOpen = false,
  invF = { type: "all", q: "all", sort: "value" },
  report = null;

const raw = localStorage.getItem(KEY);

try {
  if (raw) {
    s = E.deserialize(raw);
    report = E.applyOffline(s);
    if (report && report.elapsed < 60) report = null;
  }
} catch (e) {
  console.warn(e);
}

if (!s) s = E.newGame();

E.normalize(s);

const save = () => !window.__noSave && localStorage.setItem(KEY, E.serialize(s));

window.__game = {
  get s() {
    return s;
  },
  E,
  save,
  D,
};

document.addEventListener("click", e => {
  if (window._mapSuppress) {
    window._mapSuppress = false;
    if (e.target.closest("#worldmap")) return;
  }
  if (window._treeDragged) {
    window._treeDragged = false;
    if (e.target.closest("#treewrap")) return;
  }
  const t = e.target.closest("[data-tab]");
  if (t) {
    U.tab = t.dataset.tab;
    (U.groupLast ||= {})[groupOf(U.tab)] = U.tab;
    if (U.tab === "estate") E.tutNote(s, "estate");
    E.introView(s, U.tab);
    U.lastHTML = "";
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    render.force = true;
    render();
    scrollTo(0, 0);
    return;
  }
  const b = e.target.closest("button[data-a],a[data-a],g[data-a]");
  if (!b) return;
  const a = b.dataset.a,
    v = b.dataset.v,
    m = E.active(s);
  const local = {
    sheet: () => {
      sheetOpen = !sheetOpen;
    },
    close: () => {
      report = null;
    },
    export: () => exportSave(),
    exportsave: () => exportSave(),
    import: () =>
      importText(
        document.querySelector("#savecode") ? document.querySelector("#savecode").value : prompt("Paste save code:"),
      ),
    importsave: () => importText(document.querySelector("#savecode") && document.querySelector("#savecode").value),
    reset: () => {
      if (s.gameOver || confirm("Abandon this lineage and start over?")) {
        s = E.newLineage(s);
        report = null;
      }
    },
  };
  if (local[a]) local[a]();
  else runAction(a, { v, b, m });
  save();
  U.lastHTML = "";
  render();
});

document.addEventListener("change", e => {
  render.force = true;
  const el = e.target;
  const id = +el.dataset.v;
  const m = s.members.find(x => x.id === id);
  if (el.dataset.a === "reserve") {
    E.setReserve(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "importfile" && el.files && el.files[0]) {
    el.files[0].text().then(t => {
      importText(t);
      U.lastHTML = "";
      render();
    });
  }
  if (el.dataset.a === "chronf") U.chronF = el.value;
  if (el.dataset.a === "enchsel") (U.ench ||= {})[el.dataset.v] = el.value;
  if (el.dataset.a === "mosel") (U.moSel ||= {})[el.dataset.v] = el.value;
  if (el.dataset.a === "encpolicy") s.encPolicy = el.value;
  if (el.dataset.a === "recruitres") s.recruitReserve = Math.max(0, +el.value || 0);
  if (el.dataset.a === "refinemin") E.setRefine(s, el.dataset.v, { min: +el.value });
  if (el.dataset.a === "craftf") U.craftF[el.dataset.v] = el.value;
  if (el.dataset.a === "crafter") U.crafter = el.value;
  if (el.dataset.a === "speed") E.setSpeed(s, +el.value);
  if (el.dataset.a === "notecat") E.setNoteCat(s, el.dataset.v, el.checked);
  if (el.dataset.a === "devmode") {
    if (el.checked && !confirm("Enable Dev Mode? This run will be marked as a dev run and stop earning achievements."))
      el.checked = false;
    E.setDevMode(el.checked);
    if (el.checked) localStorage.setItem(DEV_KEY, "1");
    else {
      localStorage.removeItem(DEV_KEY);
      if (!E.speedOptions(s).includes(s.speed)) s.speed = 1;
    }
  }
  if (el.dataset.a === "invf") {
    invF[el.dataset.v] = el.value;
  }
  if (el.dataset.a === "mequipsel" && el.value) {
    E.equipMinion(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "pickpiece" && el.value) {
    const st = el.value.startsWith("store:");
    E.placePiece(s, el.dataset.v, el.value.replace("store:", ""), st);
  }
  if (el.dataset.a === "setnode" && el.value) {
    E.setMinionNode(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "mjob") {
    E.assignMinion(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "pick") {
    E.switchTo(s, +el.value);
  }
  if (el.dataset.a === "order") {
    const t = el.value;
    E.setOrder(s, id, {
      type: t,
      target: t === "train" ? "swordsmanship" : t === "quest" ? "outskirts" : t === "gather" ? "scrub" : undefined,
    });
  }
  if (el.dataset.a === "fatrack") E.setTrack(s, +el.dataset.v, el.value || null);
  if (el.dataset.a === "fapref") E.setPref(s, +el.dataset.v, el.value || null);
  if (el.dataset.a === "ordt") {
    E.setOrder(s, id, { ...m.order, target: el.value });
  }
  save();
  U.lastHTML = "";
  render();
});

let last = performance.now(),
  saveT = 0;

function loop() {
  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 5) dt = 5; // big gaps handled by offline calc
  if (!report) E.advanceReal(s, dt);
  saveT += dt;
  if (saveT >= D.tuning.autosaveSec) {
    saveT = 0;
    save();
  }
  render();
}

setInterval(loop, 500);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else {
    const r = E.applyOffline(s);
    if (r && r.elapsed > 60) report = r;
    last = performance.now();
  }
});

addEventListener("pagehide", save);

render();

// map pan / zoom (pointer + wheel); rendering pauses while dragging
{
  let drag = null;
  const pts = new Map();
  const svgPt = (svg, e) => {
    const r = svg.getBoundingClientRect();
    return {
      x: U.mv.x + ((e.clientX - r.left) / r.width) * U.mv.w,
      y: U.mv.y + ((e.clientY - r.top) / r.height) * U.mv.h,
      r,
    };
  };
  document.addEventListener("pointerdown", e => {
    const svg = e.target.closest && e.target.closest("#worldmap");
    if (!svg) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, moved: 0, svg };
    window._mapDrag = true;
  });
  document.addEventListener("pointermove", e => {
    if (!drag || !pts.has(e.pointerId)) return;
    const r = drag.svg.getBoundingClientRect();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pts.values()];
      const d1 = Math.hypot(c.x - d.x, c.y - d.y);
      if (d0 > 0) {
        const f = d0 / d1,
          cx = U.mv.x + U.mv.w / 2,
          cy = U.mv.y + U.mv.h / 2;
        U.mv.w = Math.min(D.map.size.w * 1.2, Math.max(180, U.mv.w * f));
        U.mv.h = (U.mv.w * D.map.size.h) / D.map.size.w;
        U.mv.x = cx - U.mv.w / 2;
        U.mv.y = cy - U.mv.h / 2;
      }
    } else {
      const dx = ((e.clientX - drag.x) / r.width) * U.mv.w,
        dy = ((e.clientY - drag.y) / r.height) * U.mv.h;
      U.mv.x -= dx;
      U.mv.y -= dy;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    drag.svg.setAttribute("viewBox", `${U.mv.x} ${U.mv.y} ${U.mv.w} ${U.mv.h}`);
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (!pts.size) {
      if (drag && drag.moved > 8) window._mapSuppress = true;
      drag = null;
      window._mapDrag = false;
      U.lastHTML = "";
    }
  };
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
  document.addEventListener(
    "wheel",
    e => {
      const svg = e.target.closest && e.target.closest("#worldmap");
      if (!svg) return;
      e.preventDefault();
      const p = svgPt(svg, e),
        f = e.deltaY > 0 ? 1.15 : 0.87;
      const nw = Math.min(D.map.size.w * 1.2, Math.max(180, U.mv.w * f));
      const k = nw / U.mv.w;
      U.mv.x = p.x - (p.x - U.mv.x) * k;
      U.mv.y = p.y - (p.y - U.mv.y) * k;
      U.mv.w = nw;
      U.mv.h = (nw * D.map.size.h) / D.map.size.w;
      svg.setAttribute("viewBox", `${U.mv.x} ${U.mv.y} ${U.mv.w} ${U.mv.h}`);
      U.lastHTML = "";
    },
    { passive: false },
  );
}

function exportSave() {
  const code = E.exportCode(s);
  U.exportText = code;
  U.saveMsg = "Code shown below; a .txt file was downloaded too.";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
  a.download = `family-legacy-Y${Math.floor(s.day / D.tuning.daysPerYear) + 1}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importText(text) {
  if (!text || !String(text).trim()) {
    U.saveMsg = "Paste a code or choose a file first.";
    return;
  }
  let next;
  try {
    next = E.importSave(text);
  } catch (err) {
    U.saveMsg = "❌ " + err.message;
    return;
  }
  const who = (next.members.find(m => m.id === next.activeId) || next.members[0] || {}).name;
  if (
    !confirm(
      `Overwrite the current game with this save (${who}, year ${Math.floor(next.day / D.tuning.daysPerYear) + 1})?`,
    )
  )
    return;
  s = next;
  report = null;
  U.exportText = "";
  U.saveMsg = "✅ Save imported.";
  save();
}

// family tree: drag to pan (touch uses native scrolling)
{
  let d = null;
  document.addEventListener("pointerdown", e => {
    const w = e.target.closest("#treewrap");
    if (w && e.pointerType === "mouse")
      d = { w, x: e.clientX, y: e.clientY, l: w.scrollLeft, t: w.scrollTop, moved: false };
  });
  addEventListener("pointermove", e => {
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    d.w.scrollLeft = d.l - dx;
    d.w.scrollTop = d.t - dy;
  });
  addEventListener("pointerup", () => {
    if (d && d.moved) window._treeDragged = true;
    d = null;
  });
}
