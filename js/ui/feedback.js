// Playtest feedback panel (R29.1): its own overlay (#fbpanel), outside the per-frame render so typing is never wiped.
import * as E from "../engine.js";
import { BUILD, FEEDBACK_FORM } from "../config.js";
import { FB_FIELDS, contextText, feedbackContext, feedbackText, formReady, prefillUrl } from "../feedback-core.js";
import { D, s } from "../main.js";

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ctx = () => feedbackContext(s, { build: BUILD, schema: E.SCHEMA, yearDays: D.tuning.daysPerYear, ua: navigator.userAgent });
let el = null;

// play time: seconds with the tab visible (stored in the save as s.playSec)
setInterval(() => {
  if (s && document.visibilityState === "visible") s.playSec = (s.playSec || 0) + 1;
}, 1000);

async function copy(text, msgEl, ok) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
  if (msgEl) msgEl.textContent = ok;
}
function answers() {
  const a = {};
  for (const [k] of FB_FIELDS) a[k] = el.querySelector(`[name=fb_${k}]`).value;
  a.fun = (el.querySelector("[name=fb_fun]:checked") || {}).value || "";
  a.tomorrow = (el.querySelector("[name=fb_tomorrow]:checked") || {}).value || "";
  return a;
}
export function openFeedback() {
  if (!el) {
    el = document.createElement("div");
    el.id = "fbpanel";
    document.body.appendChild(el);
  }
  const c = ctx(), ready = formReady(FEEDBACK_FORM);
  const radios = (n, vs) => vs.map(v => `<label class="fbr"><input type="radio" name="fb_${n}" value="${v}"> ${v}</label>`).join("");
  el.innerHTML = `<div class="card fbcard" role="dialog" aria-label="Feedback"><div class="row"><h3>💬 Playtest feedback</h3><button class="b" data-fb="close" aria-label="Close">✕</button></div>
<div class="fbq"><b>How fun is it?</b><div class="row fbrow">${radios("fun", ["1", "2", "3", "4", "5"])}</div></div>
${FB_FIELDS.map(([k, q]) => `<div class="fbq"><b>${q}</b><textarea name="fb_${k}" rows="3"></textarea></div>`).join("")}
<div class="fbq"><b>Would you keep playing tomorrow?</b><div class="row fbrow">${radios("tomorrow", ["Yes", "Maybe", "No"])}</div></div>
<div class="fbq"><b>Attached automatically</b><div class="muted fbctx">${esc(contextText(c))}</div></div>
<div class="row fbrow">${ready ? '<button class="b sel" data-fb="send">Open form to submit</button>' : '<button class="b sel" data-fb="copy">Copy feedback</button>'}<button class="b" data-fb="save">Copy save</button></div>
<div class="muted" data-fb-msg>${ready ? "Opens the feedback form prefilled in a new tab; press Submit there." : "Copies your answers as text: paste them to the developer."} Nothing is sent automatically.</div></div>`;
  el.hidden = false;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fb]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const k = b.dataset.fb, msg = el && el.querySelector("[data-fb-msg]");
  if (k === "open") return openFeedback();
  if (k === "close") return (el.hidden = true);
  if (k === "copy") return copy(feedbackText(answers(), ctx()), msg, "✅ Feedback copied to the clipboard.");
  if (k === "save") return copy(E.exportCode(s), msg, "✅ Save code copied (paste it into your bug report).");
  if (k === "send") {
    const u = prefillUrl(FEEDBACK_FORM, answers(), ctx());
    if (u) window.open(u, "_blank", "noopener");
    if (msg) msg.textContent = "Form opened in a new tab: press Submit there.";
  }
}, true);
