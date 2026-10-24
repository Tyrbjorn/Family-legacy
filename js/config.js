// Playtest feedback (R29.1). Fill in to send feedback through a Google Form; leave formUrl empty for the "Copy feedback" fallback.
// formUrl: the form's .../viewform URL (or the /d/e/<id>/ base); entries: the entry.<number> id for each field ("" = not sent).
// Get ids from the form's "Get pre-filled link". Radio/scale answers must match the form's option text exactly:
// fun = "1".."5", tomorrow = "Yes" / "Maybe" / "No".
export const BUILD = "R71";
export const FEEDBACK_FORM = {
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLScFNZJaWiWnlOC4E0bWszOwFOoVvv7EtIC4DFSDSoJ_TMAaJw/viewform",
  entries: {
    fun: "603926626",
    confused: "1671298765",
    bored: "1592994982",
    tooMuch: "1405083442",
    tomorrow: "418881873",
    notes: "616149813",
    context: "1605604644", // one paragraph field gets all auto context (build, save version, year, generation, play time, device)
  },
};
