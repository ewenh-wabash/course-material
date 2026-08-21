// ============================================================
// assignments.js
//
// The list of reflection assignments students can choose from.
// Each entry is { name, length } where "length" is the minimum
// number of minutes before the submit button unlocks.
//
// Edit this array directly to add, remove, rename, or re-time
// assignments — no Firestore console work needed.
// ============================================================

export const assignments = [
  { name: "Jaws", length: 20 },
  { name: "Funny Games (the 2007 version, with Naomi Watts)", length: 20 },
  { name: "American Psycho", length: 20 },
  { name: "Mandy", length: 20 },
  { name: "The Exorcist", length: 20 },
  { name: "Raw", length: 20 },
  { name: "Silence of the Lambs", length: 20 },
  { name: "The Cell (the 2000 one)", length: 20 },
  { name: "The Shining", length: 20 },
  { name: "Room 237", length: 20 },
  { name: "Sinners", length: 20 },
  { name: "From Dusk Till Dawn", length: 20 },
  { name: "28 Years Later: The Bone Temple", length: 1 },
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