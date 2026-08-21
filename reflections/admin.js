import { auth, db } from "./firebase-config.js";
import { assignments as assignmentList, slugify } from "./assignments.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------------------------------------------------------------
// Elements
// ---------------------------------------------------------------
const authScreen = document.getElementById("auth-screen");
const unauthorizedScreen = document.getElementById("unauthorized-screen");
const appScreen = document.getElementById("app-screen");

const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authError = document.getElementById("auth-error");

const whoEmail = document.getElementById("who-email");
const signoutBtn = document.getElementById("signout-btn");
const unauthSignoutBtn = document.getElementById("unauth-signout-btn");

const assignmentsTbody = document.getElementById("assignments-tbody");

const reviewSelect = document.getElementById("review-select");
const subList = document.getElementById("sub-list");
const subListEmpty = document.getElementById("sub-list-empty");

const replayPanel = document.getElementById("replay-panel");
const replayHeading = document.getElementById("replay-heading");
const replayText = document.getElementById("replay-text");
const replaySlider = document.getElementById("replay-slider");
const replayTimestamp = document.getElementById("replay-timestamp");
const replayPlayBtn = document.getElementById("replay-play-btn");
const statElapsed = document.getElementById("stat-elapsed");
const statWords = document.getElementById("stat-words");
const statEvents = document.getElementById("stat-events");
const replayViolations = document.getElementById("replay-violations");

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
authSubmitBtn.addEventListener("click", async () => {
  authError.hidden = true;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    authError.textContent = "Enter an email and password.";
    authError.hidden = false;
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    authError.textContent = "Incorrect email or password.";
    authError.hidden = false;
  }
});

signoutBtn.addEventListener("click", () => signOut(auth));
unauthSignoutBtn.addEventListener("click", () => signOut(auth));

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  authScreen.hidden = true;
  unauthorizedScreen.hidden = true;
  appScreen.hidden = true;

  if (!user) {
    authScreen.hidden = false;
    return;
  }

  const adminDoc = await getDoc(doc(db, "admins", user.uid));
  if (!adminDoc.exists()) {
    unauthorizedScreen.hidden = false;
    return;
  }

  whoEmail.textContent = user.email;
  appScreen.hidden = false;
  loadAssignments();
});

// ---------------------------------------------------------------
// Assignments — read straight from the local assignments.js list
// ---------------------------------------------------------------
let assignmentsById = {};

function loadAssignments() {
  assignmentsById = {};
  assignmentList.forEach((a) => {
    const id = slugify(a.name);
    assignmentsById[id] = { id, title: a.name, timerMinutes: a.length };
  });

  const sorted = Object.values(assignmentsById).sort((a, b) => a.title.localeCompare(b.title));

  assignmentsTbody.innerHTML = "";
  sorted.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(a.title)}</td>
      <td>${a.timerMinutes} min</td>
    `;
    assignmentsTbody.appendChild(tr);
  });

  populateReviewSelect();
}

function populateReviewSelect() {
  const current = reviewSelect.value;
  reviewSelect.innerHTML = `<option value="">Select an assignment…</option>`;
  Object.values(assignmentsById)
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.title;
      reviewSelect.appendChild(opt);
    });
  if (current && assignmentsById[current]) reviewSelect.value = current;
}

// ---------------------------------------------------------------
// Submission listing for a chosen assignment
// ---------------------------------------------------------------
reviewSelect.addEventListener("change", async () => {
  hideReplay();
  const assignmentId = reviewSelect.value;
  subList.innerHTML = "";
  subListEmpty.hidden = true;
  if (!assignmentId) return;

  const q = query(collection(db, "submissions"), where("assignmentId", "==", assignmentId));
  const snap = await getDocs(q);

  if (snap.empty) {
    subListEmpty.hidden = false;
    return;
  }

  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => (a.studentEmail || "").localeCompare(b.studentEmail || ""));

  rows.forEach((r) => {
    const row = document.createElement("div");
    row.className = "sub-row";
    const words = (r.currentText || r.finalText || "").trim().split(/\s+/).filter(Boolean).length;
    const statusPill =
      r.status === "submitted"
        ? `<span class="pill submitted">Submitted</span>`
        : `<span class="pill progress">In progress</span>`;
    const violationCount = (r.violations || []).length;
    const flagPill =
      violationCount > 0
        ? `<span class="pill flag">⚠ Violation${violationCount > 1 ? ` (${violationCount})` : ""}</span>`
        : "";
    row.innerHTML = `
      <span>${escapeHtml(r.studentEmail || r.uid)} — ${statusPill} · ${words} words ${flagPill}</span>
      <button data-id="${r.id}" type="button">View replay</button>
    `;
    subList.appendChild(row);
  });

  subList.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => openReplay(btn.dataset.id, rows.find((r) => r.id === btn.dataset.id)));
  });
});

// ---------------------------------------------------------------
// Replay / scrub viewer
// ---------------------------------------------------------------
let replayEvents = []; // sorted [{t, text}]
let playTimer = null;

async function openReplay(submissionId, subData) {
  stopPlayback();
  replayHeading.textContent = `${subData.studentEmail || subData.uid}`;
  replayPanel.hidden = false;
  replayText.textContent = "Loading…";

  const historyQ = query(
    collection(db, "submissions", submissionId, "history"),
    orderBy("batchStart", "asc")
  );
  const snap = await getDocs(historyQ);

  const events = [];
  snap.forEach((d) => {
    const data = d.data();
    (data.events || []).forEach((e) => events.push(e));
  });
  events.sort((a, b) => a.t - b.t);

  // Make sure the final submitted text is represented at the end, in case
  // the last keystrokes hadn't flushed to the history log yet.
  if (subData.submittedAt && subData.finalText !== undefined) {
    events.push({ t: subData.submittedAt.toMillis(), text: subData.finalText });
  }

  replayEvents = events;

  if (replayEvents.length === 0) {
    replayText.textContent = "No keystroke history recorded for this submission.";
    replaySlider.disabled = true;
    renderViolations(subData);
    return;
  }

  replaySlider.disabled = false;
  replaySlider.min = 0;
  replaySlider.max = replayEvents.length - 1;
  replaySlider.value = replayEvents.length - 1;
  statEvents.textContent = replayEvents.length;

  renderViolations(subData);
  renderReplayAt(replayEvents.length - 1);
}

const VIOLATION_LABELS = {
  "fullscreen-exit": "Exited fullscreen",
  "tab-hidden": "Left tab / minimized window",
  "window-blur": "Window lost focus",
  "left-without-submitting": "Closed/reloaded without submitting",
};

function renderViolations(subData) {
  const violations = subData.violations || [];
  if (violations.length === 0) {
    replayViolations.innerHTML = "";
    return;
  }
  const startMs = subData.startedAt ? subData.startedAt.toMillis() : violations[0].t;
  const sorted = [...violations].sort((a, b) => a.t - b.t);
  const lines = sorted.map((v) => {
    const elapsedMs = Math.max(0, v.t - startMs);
    const mins = Math.floor(elapsedMs / 60000);
    const secs = Math.floor((elapsedMs % 60000) / 1000);
    const label = VIOLATION_LABELS[v.type] || v.type;
    return `<span class="violation-row">${label} — at ${mins}m ${secs}s</span>`;
  });
  replayViolations.innerHTML = `
    <div class="violation-alert">
      <div class="violation-alert-title">⚠ VIOLATION — ${violations.length} flagged event${violations.length === 1 ? "" : "s"}</div>
      ${lines.join("")}
    </div>
  `;
}

function hideReplay() {
  stopPlayback();
  replayPanel.hidden = true;
  replayEvents = [];
}

replaySlider.addEventListener("input", () => {
  stopPlayback();
  renderReplayAt(parseInt(replaySlider.value, 10));
});

function renderReplayAt(index) {
  const ev = replayEvents[index];
  if (!ev) return;
  replayText.textContent = ev.text;

  const startT = replayEvents[0].t;
  const elapsedMs = ev.t - startT;
  const mins = Math.floor(elapsedMs / 60000);
  const secs = Math.floor((elapsedMs % 60000) / 1000);
  replayTimestamp.textContent = `${new Date(ev.t).toLocaleTimeString()}`;
  statElapsed.textContent = `${mins}m ${secs}s`;

  const words = ev.text.trim().split(/\s+/).filter(Boolean).length;
  statWords.textContent = words;
}

replayPlayBtn.addEventListener("click", () => {
  if (playTimer) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

function startPlayback() {
  if (replayEvents.length === 0) return;
  let idx = parseInt(replaySlider.value, 10);
  if (idx >= replayEvents.length - 1) idx = 0; // restart from beginning if at end

  replayPlayBtn.textContent = "❚❚";
  // Compress the whole timeline into ~12 seconds of playback, stepping through events.
  const stepMs = Math.max(15, Math.floor(12000 / replayEvents.length));

  playTimer = setInterval(() => {
    idx++;
    if (idx >= replayEvents.length) {
      stopPlayback();
      return;
    }
    replaySlider.value = idx;
    renderReplayAt(idx);
  }, stepMs);
}

function stopPlayback() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  replayPlayBtn.textContent = "▶";
}

// ---------------------------------------------------------------
// Utils
// ---------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}