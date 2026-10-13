import * as E from "../../engine.js";
import { s } from "../../main.js";
import { U } from "../state.js";
import { tourList } from "../guide.js";
import { toggleDock } from "../progress.js";

// Click actions for the meta area. ctx = { v, w, b, m } from the clicked element.
export const metaActions = ({ v, b, m }) => ({
  turbo: () => E.toggleTurbo(s),
  dock: () => toggleDock(),
  gotab: () => {
    U.tab = v;
    if (v === "estate") E.tutNote(s, "estate");
    E.introView(s, v);
    scrollTo(0, 0);
  },
  bell: () => {
    U.bell = !U.bell;
    if (!U.bell) E.markNotesRead(s);
  },
  bellread: () => E.markNotesRead(s),
  mentorcraft: () => E.mentorCraft(s),
  introskip: () => E.introSkip(s, v),
  tutskip: () => confirm("Skip the apprenticeship? You keep what you've earned so far.") && E.skipTutorial(s),
  tourstart: () => {
    U.tour = 0;
    U.tab = "main";
  },
  tournext: () => {
    U.tour++;
    const st = tourList()[U.tour];
    if (st) U.tab = st.tab;
  },
  tourend: () => {
    U.tour = null;
    E.markTourSeen(s);
  },
  ver: () => {
    if (++U.verTaps >= 5) U.devRevealed = true;
  },
  dev: () => E.devCheat(s, v),
  devtut: () => E.completeTutorial(s),
  legacy: () => E.buyLegacy(s, v),
  enc: () => E.resolvePending(s, v),
  class: () => E.chooseClass(s, s.pendingClass[0], v),
  switch: () => E.switchTo(s, +v),
});
