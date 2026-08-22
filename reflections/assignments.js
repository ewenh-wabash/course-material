// ============================================================
// assignments.js
//
// The list of reflection assignments students can choose from.
// Each entry is { name, length, prompts } where:
//   - "length"  is the minimum number of minutes before the
//     submit button unlocks.
//   - "prompts" is an array of prompt strings specific to that
//     film. While writing, students can click a "Show a prompt"
//     button to get a random one (shuffled, no repeats until the
//     list runs out). This is just the *starting* list — students
//     can also contribute additional prompts for a film after
//     they submit their own reflection for it; those get pulled
//     from Firestore (the "promptSubmissions" collection) and
//     merged in alongside these whenever the film is selected.
//
// Edit this array directly to add, remove, rename, or re-time
// assignments, or to add/edit prompts — no Firestore console
// work needed for any of that.
// ============================================================

export const assignments = [
  { name: "Jaws", length: 20, prompts: [] },
  { name: "Funny Games (the 2007 version, with Naomi Watts)", length: 20, prompts: [] },
  { name: "American Psycho", length: 20, prompts: [] },
  { name: "Mandy", length: 20, prompts: [] },
  { name: "The Exorcist", length: 20, prompts: [] },
  { name: "Raw", length: 20, prompts: [] },
  { name: "Silence of the Lambs", length: 20, prompts: [] },
  { name: "The Cell (the 2000 one)", length: 20, prompts: [] },
  { name: "The Shining", length: 20, prompts: [] },
  { name: "Room 237", length: 20, prompts: [] },
  { name: "Sinners", length: 20, prompts: [] },
  { name: "From Dusk Till Dawn", length: 20, prompts: ["here's a prompt to try", "here's another prompt", "and a third"] },
  { name: "28 Years Later: The Bone Temple", length: 1, prompts: [] },
];

// Turns a name into a stable, URL/Firestore-safe id, e.g.
// "The Cell (the 2000 one)" -> "the-cell-the-2000-one"
// Used as the assignment's identifier in Firestore document paths,
// so it must stay consistent between student.js and admin.js
// (both import it from here rather than each defining their own).
export function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}