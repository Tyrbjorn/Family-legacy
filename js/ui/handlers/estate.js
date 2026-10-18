import { U } from "../state.js";
import * as E from "../../engine.js";
import { s } from "../../main.js";

// Click actions for the estate area. ctx = { v, w, b, m } from the clicked element.
export const estateActions = ({ v, b, m }) => ({
  build: () => E.build(s, v),
  fieldbuild: () => E.buildField(s, v), // R40 fields
  fieldlvl: () => E.levelField(s, v),
  fieldsize: () => E.sizeUp(s, v),
  fieldsmall: () => E.sizeDown(s, v),
  fieldtoggle: () => E.toggleField(s, v),
  fieldsauto: () => E.setFieldsAuto(s, v),
  hubup: () => E.buyHubUp(s, v),
  animalbuy: () => E.buyAnimals(s, v), // R41
  choretoggle: () => E.toggleChore(s, v), // R42
  oadd: () => { const it = U.oItem || document.querySelector("[data-a=oitem]")?.value, n = U.oNum || +(document.querySelector("[data-a=onum]")?.value || 3); E.addOrder(s, it, n); }, // R43 orders
  oup: () => E.moveOrder(s, v, -1),
  odown: () => E.moveOrder(s, v, 1),
  opause: () => E.toggleOrderPause(s, v),
  opwd: () => { const o = E.orderList(s).find(x => x.id === v); E.setOrderPauseWhenDone(s, v, !(o && o.pwd)); },
  odel: () => E.removeOrder(s, v),
  apwd: () => E.setAutoPwd(s, v, !E.autoPwd(s, v)), // R44 pause when done: automation lines
  ppwd: () => { const p = E.living(s).find(m => String(m.id) === v) || (s.minions || []).find(mi => mi.uid === v); E.setPauseWhenDone(s, v, !(p && p.pwd)); }, // R44 people
  presume: () => E.resumePerson(s, v),
  qoff: () => E.toggleQuotaOff(s, v), // R43 quotas: pause / pause when done
  qpwd: () => { const q = E.quotaList(s).find(x => x.id === v); E.setQuotaPauseWhenDone(s, v, !(q && q.pwd)); },
  animalup: () => E.buySpotsUp(s, v),
  struct: () => E.buildStructure(s, v),
  upstruct: () => E.upgradeStructure(s, v, b.dataset.w),
  respec: () => E.respecStructure(s, v, b.dataset.w),
  demolish: () => {
    if (confirm("Demolish this building? Half its cost is refunded; furniture goes to storage.")) E.demolishStructure(s, v);
  },
  unpiece: () => E.removePiece(s, v, b.dataset.w),
  upspecial: () => E.upgradeSpecial(s, v),
  tierup: () => E.tierUp(s, v),
  spec: () => E.specialize(s, v, b.dataset.w),
  buyfit: () => E.buyFitting(s, v, b.dataset.w),
  uppiece: () => E.upgradePiece(s, v, b.dataset.w),
  toggle: () => E.togglePiece(s, v, b.dataset.w),
  refine: () => {
    const st = s.structures.find(x => x.uid === v),
      r = st && E.refineOf(st);
    if (r) E.setRefine(s, v, b.dataset.w === "on" ? { on: !r.on } : { stopFull: !r.stopFull });
  },
  autotog: () => E.toggleAuto(s, v),
  buyquad: () => E.buyQuadMap(s, v),
  faex: () => {
    const x = s.members.find(y => y.id === +v);
    if (x) x.noAutoEq = !x.noAutoEq;
  },
  apprset: () => {
    const x = s.members.find(y => y.id === +b.dataset.w);
    if (x) E.setAppr(s, x, v || null);
  },
  talenttog: () => {
    const x = s.members.find(y => y.id === +b.dataset.w);
    if (x) E.toggleTalent(s, x, v);
  },
  enshrine: () => E.enshrine(s, v, b.dataset.w),
  refundok: () => s.legacyRefund && (s.legacyRefund.seen = true),
  faunpin: () => E.unpin(s, +v, b.dataset.w),
  fahead: () => (s.faCourtHead = !s.faCourtHead),
  autorecruit: () => E.toggleRecruit(s),
  recruitmode: () => E.setRecruitMode(s, v),
  egmount: () => E.buyMount(s),
  egquarry: () => E.buildQuarry(s, v),
  egdef: () => E.buildDefense(s, v),
  egfund: () => E.fundTown(s, v),
  ascup: () => E.raiseBranch(s, v),
  keepjob: () => E.toggleKeepJob(s.minions.find(x => x.uid === v)),
  land: () => E.buyLand(s, v),
  vup: () => E.upgradeVillage(s),
  vbuild: () => E.buildVillage(s, v, +b.dataset.w),
  reloc: () => E.relocate(s, v),
  vdeliver: () => E.deliverAll(s),
  vauto: () => E.toggleAutoDeliver(s),
  vcancel: () => E.cancelProject(s),
  ration: () => E.setRation(s, v),
  diet: () => E.toggleDiet(s, v),
  qadd: () => { const it = U.qItem || document.querySelector('[data-a=qitem]')?.value, n = U.qNum || +(document.querySelector('[data-a=qnum]')?.value || 50); if (!E.addQuota(s, it, n, v)) E.log(s, "📋 " + (E.quotaIssue(s, it, v) || "can't add that quota")); },
  qdel: () => E.removeQuota(s, v),
  qup: () => E.moveQuota(s, v, -1),
  qdown: () => E.moveQuota(s, v, 1),
  qmode: () => { const q = E.quotaList(s).find(x => x.id === v); return q && E.setQuotaMode(s, v, q.mode === "once" ? "standing" : "once"); },
  quotasgo: () => setTimeout(() => document.querySelector("#quotas")?.scrollIntoView({ block: "start" }), 200),
  cooklux: () => E.setCookLuxury(s, !s.cookLuxury),
  room: () => E.addRoom(s, v),
  unroom: () => E.removeRoom(s, +v),
  mevolve: () => E.evolveMinion(s, v, b.dataset.w),
  hire: () => E.hire(s, v, b.dataset.w),
  dismiss: () => E.dismiss(s, v),
  mequip: () => E.equipMinion(s, v, b.dataset.w),
  munequip: () => E.unequipMinion(s, v, b.dataset.w),
});
