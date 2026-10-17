// Apprentice tutorial card, tab-tour overlay and the Settings card (notifications, tour, dev mode).
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { groupOf, tabVisible } from "./render.js";

const rew = r =>
  Object.entries(r || {})
    .map(([k, v]) =>
      k === "items"
        ? v.map(id => "🎁 " + E.itemDef(id).name).join(", ")
        : k === "unlock"
          ? "📜 recipe: " + (E.recipeDef(v.split(":")[1])?.name || v)
          : `+${v} ${k}`,
    )
    .join(", ");

export function tutorialCard() {
  if (!E.tutActive(s) || !s.tut.started) return "";
  const st = E.tutCurrent(s),
    mt = E.tutMentor(),
    steps = E.tutSteps(),
    n = s.tut.step;
  const rq = st.check === "quest:rats" && D.quests.find(q => q.id === "rats"),
    rIss = rq && (E.questIssue(s, E.active(s), rq) || E.questAgeIssue(E.active(s), rq, s)),
    ron = rq && E.active(s).action && E.active(s).action.target === "rats";
  const ratsBtn = rq ? `<button class="b sel big" data-a="quest" data-v="rats" ${rIss || ron ? "disabled" : ""}>🐀 ${ron ? "On it: Rats in the Cellar" : "Go: Rats in the Cellar"}</button>${rIss ? `<span class="muted">${rIss}</span>` : ""}` : "";
  const craftBtn =
    st.check === "crafted"
      ? `<button class="b" data-a="mentorcraft" ${E.recipeIssue(s, E.active(s), E.recipeDef("r_whittle")) ? "disabled" : ""}>🔨 Whittle at ${mt.name.split(" ").pop()}'s bench (2 wood)</button>`
      : "";
  return `<div class="card tut"><div class="row"><b>${mt.icon} ${mt.name}</b><span class="muted">${mt.title || ""}</span><span style="flex:1"></span><button class="b" data-a="tutskip" title="Skip the apprenticeship">Skip</button></div>
${n === 0 ? `<p class="muted">${D.tutorial.intro}</p>${D.tutorial.howToPlay ? `<p class="muted"><b>${D.tutorial.howToPlay.replace(/^How to play:\s*/, "How to play:</b> ")}</p>` : ""}` : ""}
<div class="pb"><i style="width:${(n / steps.length) * 100}%"></i><span>Prologue: The Apprentice · ${n}/${steps.length}</span></div>
<p><b>${st.icon} ${st.title}</b>: ${st.text}</p><div class="muted">Reward: ${rew(st.reward)}</div>${st.tip ? `<div class="tip">💡 ${st.tip}</div>` : ""}<div class="row">${ratsBtn}${craftBtn}${goBtns(st)}</div></div>`;
}

// Unlock intro lines (data/intros.json): same card look as the prologue; never blocking, one Skip each.
export function introCards(tab) {
  return E.introsActive(s)
    .filter(l => tab === "main" || l.tab === tab)
    .map(l => {
      const st = E.introCurrent(s, l.id),
        n = s.intros.lines[l.id].step;
      return `<div class="card tut"><div class="row"><b>${l.icon} ${l.name} ${n}/${l.steps.length}</b><span style="flex:1"></span><button class="b" data-a="introskip" data-v="${l.id}" title="Skip this intro">Skip</button></div>
<div class="pb"><i style="width:${(n / l.steps.length) * 100}%"></i><span>${st.title} · ${rew(st.reward)}</span></div>${n === 0 ? `<div class="muted" style="font-size:12px">${l.intro}</div>` : ""}</div>`;
    })
    .join("");
}

// ---- tab tour overlay
export function tourOverlay() {
  if (U.tour == null) return "";
  const steps = tourList();
  const st = steps[U.tour];
  if (!st) return "";
  const btn =
    document.querySelector(`#subtabs [data-tab="${st.tab}"]`) ||
    document.querySelector(`#tabs [data-group="${groupOf(st.tab)}"]`);
  const r = btn ? btn.getBoundingClientRect() : { left: 0, top: innerHeight - 60, width: 60, height: 50 };
  const tipTop = Math.max(8, r.top - 150);
  return `<div class="tourmask"></div><div class="tourhole" style="left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px"></div>
<div class="tourtip card" style="top:${tipTop}px"><b>${U.tour + 1}/${steps.length}</b> ${st.text}<div class="row"><button class="b" data-a="tourend">Close</button><span style="flex:1"></span>${
    U.tour + 1 < steps.length
      ? `<button class="b sel" data-a="tournext">Next ›</button>`
      : `<button class="b sel" data-a="tourend">Done</button>`
  }</div></div>`;
}
export const tourList = () => E.tourSteps().filter(t => tabVisible(t.tab));

export function tourPrompt() {
  if (s.tut?.tourSeen || U.tour != null) return "";
  return `<div class="card"><b>👋 Welcome to Family Legacy!</b> Want a quick tour of the tabs? <div class="row"><button class="b sel" data-a="tourstart">Show me around</button><button class="b" data-a="tourend">No thanks</button></div></div>`;
}

// ---- settings
export function settingsCard() {
  const cats = E.noteCats();
  const off = s.noteOff || {};
  const dev = E.devOn();
  return `<h3>⚙️ Settings</h3>
<div class="muted">Notifications (in-game only):</div><div class="row" style="flex-wrap:wrap;gap:4px">${Object.entries(
    cats,
  )
    .map(
      ([k, c]) =>
        `<label class="chip"><input type="checkbox" data-a="notecat" data-v="${k}" ${off[k] ? "" : "checked"}> ${c.icon} ${c.name}</label>`,
    )
    .join("")}</div>
<div class="muted">Game difficulty (any time; quests and crafts already under way keep the level they started with):</div><div class="row" style="flex-wrap:wrap;gap:4px">${[1, 2, 3, 4, 5]
  .map(l => `<button class="b${l === E.gameLvl(s) ? " on" : ""}" data-a="setdiff" data-v="${l}">${E.diffName(l)}</button>`)
  .join("")}</div>
<div class="row"><button class="b" data-a="tourstart">🧭 Tab tour</button>${E.tutActive(s) ? `<button class="b" data-a="tutskip">Skip apprenticeship</button>` : ""}</div>
${
  U.devRevealed || dev
    ? `<div class="row"><label class="chip"><input type="checkbox" data-a="devmode" ${dev ? "checked" : ""}> 🛠️ Dev Mode</label><span class="muted">Dev runs earn no achievements.</span></div>${
        dev
          ? `<div class="row" style="flex-wrap:wrap;gap:4px"><button class="b" data-a="dev" data-v="coin">+10k coin</button><button class="b" data-a="dev" data-v="res">+500 resources</button><button class="b" data-a="dev" data-v="turbo">Max turbo</button><button class="b" data-a="dev" data-v="tabs">Unlock tabs</button><button class="b" data-a="devtut">Complete tutorial</button><button class="b" data-a="tutskip">Skip tutorial</button></div>`
          : ""
      }`
    : ""
}
<div class="muted" style="margin-top:6px"><a data-a="ver" class="ver">Family Legacy ${VERSION}</a></div>`;
}
export const VERSION = "v1.7";

// R31: each task step gets big Go buttons (data: step.go), with the lock reason shown when it can't start yet
function goBtns(st) {
  const m = E.active(s);
  return (st.go || [])
    .map(g => {
      const ac = D.activities.find(a => a.id === g.target);
      if (!ac || !m) return "";
      const on = m.action && m.action.type === "activity" && m.action.target === ac.id;
      const why = E.taskLock(s, m, ac);
      return `<button class="b ${on ? "" : "sel"} big" data-a="activity" data-v="${ac.id}" ${why || on ? "disabled" : ""}>${on ? "Doing: " + ac.name : "Go: " + g.label}</button>${why ? `<span class="muted">🔒 ${why}</span>` : ""}`;
    })
    .join("");
}
