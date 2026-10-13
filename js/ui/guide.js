// Apprentice tutorial card, tab-tour overlay and the Settings card (notifications, tour, dev mode).
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";

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
  const craftBtn =
    st.check === "crafted"
      ? `<button class="b" data-a="mentorcraft" ${E.recipeIssue(s, E.active(s), E.recipeDef("r_whittle")) ? "disabled" : ""}>🔨 Whittle at ${mt.name.split(" ").pop()}'s bench (2 wood)</button>`
      : "";
  return `<div class="card tut"><div class="row"><b>${mt.icon} ${mt.name}</b><span class="muted">${mt.title || ""}</span><span style="flex:1"></span><button class="b" data-a="tutskip" title="Skip the apprenticeship">Skip</button></div>
${n === 0 ? `<p class="muted">${D.tutorial.intro}</p>` : ""}
<div class="pb"><i style="width:${(n / steps.length) * 100}%"></i><span>Prologue: The Apprentice · ${n}/${steps.length}</span></div>
<p><b>${st.icon} ${st.title}</b>: ${st.text}</p><div class="muted">Reward: ${rew(st.reward)}</div><div class="row">${craftBtn}</div></div>`;
}

// ---- tab tour overlay
export function tourOverlay() {
  if (U.tour == null) return "";
  const steps = E.tourSteps().filter(t => document.querySelector(`[data-tab="${t.tab}"]`));
  const st = steps[U.tour];
  if (!st) return "";
  const btn = document.querySelector(`#tabs [data-tab="${st.tab}"]`);
  const r = btn ? btn.getBoundingClientRect() : { left: 0, top: innerHeight - 60, width: 60, height: 50 };
  const tipTop = Math.max(8, r.top - 150);
  return `<div class="tourmask"></div><div class="tourhole" style="left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px"></div>
<div class="tourtip card" style="top:${tipTop}px"><b>${U.tour + 1}/${steps.length}</b> ${st.text}<div class="row"><button class="b" data-a="tourend">Close</button><span style="flex:1"></span>${
    U.tour + 1 < steps.length
      ? `<button class="b sel" data-a="tournext">Next ›</button>`
      : `<button class="b sel" data-a="tourend">Done</button>`
  }</div></div>`;
}
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
