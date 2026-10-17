import * as E from "../../engine.js";
import { s } from "../../main.js";

// Click actions for the estate area. ctx = { v, w, b, m } from the clicked element.
export const estateActions = ({ v, b, m }) => ({
  build: () => E.build(s, v),
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
  room: () => E.addRoom(s, v),
  unroom: () => E.removeRoom(s, +v),
  mevolve: () => E.evolveMinion(s, v, b.dataset.w),
  hire: () => E.hire(s, v, b.dataset.w),
  dismiss: () => E.dismiss(s, v),
  mequip: () => E.equipMinion(s, v, b.dataset.w),
  munequip: () => E.unequipMinion(s, v, b.dataset.w),
});
