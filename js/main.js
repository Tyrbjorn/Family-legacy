import * as E from "./engine.js";
import { U } from "./ui/state.js";
import { curList } from "./ui/common.js";
import { render } from "./ui/render.js";

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
];

export const D = {};

await Promise.all(names.map(async n => (D[n] = await (await fetch(`data/${n}.json`)).json())));

E.setData(D);

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
  const t = e.target.closest("[data-tab]");
  if (t) {
    U.tab = t.dataset.tab;
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
  ({
    turbo: () => E.toggleTurbo(s),
    train: () => E.setAction(s, { type: "train", target: v }),
    sheet: () => {
      sheetOpen = !sheetOpen;
    },
    job: () => E.setAction(s, { type: "job", target: v }),
    activity: () => E.setAction(s, { type: "activity", target: v }),
    rest: () => E.setAction(s, { type: "rest" }),
    quest: () => {
      E.setAction(s, { type: "quest", target: v });
    },
    court: () => E.setAction(s, { type: "court", target: v }),
    gift: () => E.giveGift(s, v, b.dataset.w),
    propose: () => E.propose(s, v),
    evolve: () => E.evolve(s, m, v),
    build: () => E.build(s, v),
    struct: () => E.buildStructure(s, v),
    upstruct: () => E.upgradeStructure(s, v),
    unpiece: () => E.removePiece(s, v, b.dataset.w),
    upspecial: () => E.upgradeSpecial(s, v),
    spec: () => E.specialize(s, v, b.dataset.w),
    mevolve: () => E.evolveMinion(s, v, b.dataset.w),
    dungeon: () => E.setAction(s, { type: "dungeon", target: v }),
    auto: () => E.setAction(s, { type: "auto", target: v }),
    stopauto: () => E.setAction(s, { type: "stopauto" }),
    explore: () => E.setAction(s, { type: "explore", target: v }),
    mapsel: () => {
      U.mapSel = v;
    },
    zoom: () => {
      const f = +v,
        W = D.map.size.w,
        H = D.map.size.h;
      if (!f) {
        U.mv = { x: 0, y: 0, w: W, h: H };
      } else {
        const cx = U.mv.x + U.mv.w / 2,
          cy = U.mv.y + U.mv.h / 2;
        U.mv.w = Math.min(W * 1.2, Math.max(180, U.mv.w * f));
        U.mv.h = (U.mv.w * H) / W;
        U.mv.x = cx - U.mv.w / 2;
        U.mv.y = cy - U.mv.h / 2;
      }
    },
    uppiece: () => E.upgradePiece(s, v, b.dataset.w),
    toggle: () => E.togglePiece(s, v, b.dataset.w),
    cqueue: () =>
      E.queueCraft(
        s,
        s.members.find(x => x.id === +v),
        b.dataset.w,
      ),
    cunq: () =>
      E.unqueueCraft(
        s.members.find(x => x.id === +v),
        +b.dataset.w,
      ),
    mcraft: () => {
      const mi = s.minions.find(x => x.uid === v);
      E.setMinionCraft(s, mi, mi && mi.craftOrder === b.dataset.w ? null : b.dataset.w);
    },
    legacy: () => E.buyLegacy(s, v),
    equip: () => E.equip(s, m, v),
    equipbag: () => E.equip(s, m, v, "bag"),
    unequip: () => E.unequip(s, m, v),
    tobag: () => E.moveItem(s, m, v, true),
    tovault: () => E.moveItem(s, m, v, false),
    buy: () => E.buyItem(s, v, b.dataset.w),
    sellres: () => E.sellRes(s, v, b.dataset.w, 10),
    rumor: () => E.rumor(s, v),
    sellallres: () => E.sellAllRes(s, v, b.dataset.w),
    bulksell: () => E.sellMany(s, curList()),
    bulklist: () => curList().forEach(id => E.listForSale(s, id)),
    list: () => E.listForSale(s, v),
    unlist: () => E.unlist(s, v),
    craft: () => E.setAction(s, { type: "craft", target: v }),
    mequip: () => E.equipMinion(s, v, b.dataset.w),
    munequip: () => E.unequipMinion(s, v, b.dataset.w),
    land: () => E.buyLand(s, v),
    room: () => E.addRoom(s, v),
    unroom: () => E.removeRoom(s, +v),
    advjoin: () => E.joinAdventurers(s, m),
    advrank: () => E.advRankUp(s, m),
    advbuy: () => E.buyAdvItem(s, m, v),
    join: () => E.joinGuild(s, m, v),
    rankup: () => E.rankUp(s, m, v || undefined),
    gbuy: () => E.buyGuildItem(s, m, v),
    hire: () => E.hire(s, v, b.dataset.w),
    dismiss: () => E.dismiss(s, v),
    gather: () => E.setAction(s, { type: "gather", target: v }),
    sell: () => E.sell(s, v),
    switch: () => E.switchTo(s, +v),
    class: () => E.chooseClass(s, s.pendingClass[0], v),
    close: () => {
      report = null;
    },
    export: () => {
      prompt("Copy your save:", btoa(unescape(encodeURIComponent(E.serialize(s)))));
    },
    import: () => {
      const t = prompt("Paste save:");
      if (t) {
        try {
          s = E.deserialize(decodeURIComponent(escape(atob(t))));
        } catch (err) {
          alert("Invalid save");
        }
      }
    },
    reset: () => {
      if (s.gameOver || confirm("Abandon this lineage and start over?")) {
        s = E.newLineage(s);
        report = null;
      }
    },
  })[a]?.();
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
  if (el.dataset.a === "craftf") U.craftF[el.dataset.v] = el.value;
  if (el.dataset.a === "crafter") U.crafter = el.value;
  if (el.dataset.a === "speed") E.setSpeed(s, +el.value);
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
      target:
        t === "train" ? "swordsmanship" : t === "quest" ? "outskirts" : t === "gather" ? "scrub" : undefined,
    });
  }
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
