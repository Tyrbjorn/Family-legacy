// Shared mutable UI state (written from several modules).
export const U = {
  estView: (() => { try { return localStorage.getItem("fl-estview") === "map" ? "map" : "list"; } catch { return "list"; } })(), // R62, not saved
  estSel: "",
  estRoom: null, // R66: uid of the building whose interior is open (not saved)
  estRoomT: 0,
  tab: "main",
  lastHTML: "",
  mapSel: null,
  mv: null,
  craftF: { station: "all", skill: "all" },
  crafter: null,
  chronF: "all",
  exportText: "",
  saveMsg: "",
  bell: false,
  tour: null,
  treeSel: null,
  devRevealed: false,
  verTaps: 0,
};
