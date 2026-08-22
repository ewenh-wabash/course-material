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
  deleteDoc,
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

const reviewPanel = document.getElementById("review-panel");
const reviewHeading = document.getElementById("review-heading");
const subList = document.getElementById("sub-list");
const subListEmpty = document.getElementById("sub-list-empty");

const promptsPanel = document.getElementById("prompts-panel");
const promptsHeading = document.getElementById("prompts-heading");
const communityPromptsList = document.getElementById("community-prompts-list");
const communityPromptsEmpty = document.getElementById("community-prompts-empty");

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
const replayPrompts = document.getElementById("replay-prompts");

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
      <td><button class="link-btn" type="button" data-panel="prompts" data-id="${a.id}">View prompts</button></td>
      <td><button class="link-btn" type="button" data-panel="review" data-id="${a.id}">Review</button></td>
    `;
    assignmentsTbody.appendChild(tr);
  });

  assignmentsTbody.querySelectorAll('button[data-panel="prompts"]').forEach((btn) => {
    btn.addEventListener("click", () => showPromptsFor(btn.dataset.id, btn));
  });
  assignmentsTbody.querySelectorAll('button[data-panel="review"]').forEach((btn) => {
    btn.addEventListener("click", () => showReviewFor(btn.dataset.id, btn));
  });
}

// Highlights the clicked button and un-highlights any previously-active
// button for the same column (prompts or review), so it's clear which
// assignment each open panel is currently showing.
function setActiveButton(panelName, activeBtn) {
  assignmentsTbody.querySelectorAll(`button[data-panel="${panelName}"]`).forEach((btn) => {
    btn.classList.toggle("active", btn === activeBtn);
  });
}

// ---------------------------------------------------------------
// Submission listing for a chosen assignment
// ---------------------------------------------------------------
async function showReviewFor(assignmentId, activeBtn) {
  setActiveButton("review", activeBtn);
  setActiveButton("prompts", null);
  hideReplay();
  promptsPanel.hidden = true;
  reviewHeading.textContent = `Review submissions — ${assignmentsById[assignmentId]?.title || ""}`;
  reviewPanel.hidden = false;
  subList.innerHTML = "";
  subListEmpty.hidden = true;

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
}

// ---------------------------------------------------------------
// Community-submitted prompts (moderation)
// ---------------------------------------------------------------
async function showPromptsFor(assignmentId, activeBtn) {
  setActiveButton("prompts", activeBtn);
  setActiveButton("review", null);
  hideReplay();
  reviewPanel.hidden = true;
  promptsHeading.textContent = `Community prompts — ${assignmentsById[assignmentId]?.title || ""}`;
  promptsPanel.hidden = false;
  communityPromptsList.innerHTML = "";
  communityPromptsEmpty.hidden = true;

  const q = query(collection(db, "promptSubmissions"), where("assignmentId", "==", assignmentId));
  const snap = await getDocs(q);

  if (snap.empty) {
    communityPromptsEmpty.hidden = false;
    return;
  }

  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const at = a.createdAt ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt ? b.createdAt.toMillis() : 0;
    return bt - at; // newest first
  });

  rows.forEach((p) => {
    const row = document.createElement("div");
    row.className = "sub-row";
    row.innerHTML = `
      <span>${escapeHtml(p.text || "")} <span class="hint">— added by ${escapeHtml(p.addedByEmail || p.addedByUid || "unknown")}</span></span>
      <button data-id="${p.id}" type="button">Delete</button>
    `;
    communityPromptsList.appendChild(row);
  });

  communityPromptsList.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Deleting…";
      try {
        await deleteDoc(doc(db, "promptSubmissions", btn.dataset.id));
        btn.closest(".sub-row").remove();
        if (!communityPromptsList.children.length) communityPromptsEmpty.hidden = false;
      } catch (err) {
        console.error("Couldn't delete prompt:", err);
        btn.disabled = false;
        btn.textContent = "Delete";
      }
    });
  });
}

// ---------------------------------------------------------------
// Replay / scrub viewer
// ---------------------------------------------------------------
let replayEvents = []; // sorted [{t, text}]
let promptEventsAll = []; // sorted [{t, prompt}], full list for the open submission
let replayStartMs = 0;
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
  promptEventsAll = [...(subData.promptEvents || [])].sort((a, b) => a.t - b.t);
  replayStartMs = subData.startedAt
    ? subData.startedAt.toMillis()
    : (promptEventsAll[0]?.t ?? events[0]?.t ?? Date.now());

  if (replayEvents.length === 0) {
    replayText.textContent = "No keystroke history recorded for this submission.";
    replaySlider.disabled = true;
    renderViolations(subData);
    // No timeline to scrub, so just show every prompt that was ever shown.
    renderPromptsUpTo(Infinity);
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

// Prompt-button presses, filtered to only the ones shown up through
// cutoffT — so the list grows/shrinks as the replay slider is scrubbed,
// same as the transcript text itself does.
function renderPromptsUpTo(cutoffT) {
  const upTo = promptEventsAll.filter((e) => e.t <= cutoffT);

  if (promptEventsAll.length === 0) {
    replayPrompts.innerHTML = "";
    return;
  }
  if (upTo.length === 0) {
    replayPrompts.innerHTML = `<p class="hint">No prompts requested yet at this point.</p>`;
    return;
  }

  const lines = upTo.map((e) => {
    const elapsedMs = Math.max(0, e.t - replayStartMs);
    const mins = Math.floor(elapsedMs / 60000);
    const secs = Math.floor((elapsedMs % 60000) / 1000);
    return `<span class="violation-row">${mins}m ${secs}s — "${escapeHtml(e.prompt)}"</span>`;
  });

  const countLabel =
    upTo.length === promptEventsAll.length
      ? `${upTo.length} prompt${upTo.length === 1 ? "" : "s"} shown`
      : `${upTo.length} of ${promptEventsAll.length} prompts shown so far`;

  replayPrompts.innerHTML = `
    <div class="violation-alert" style="margin-top:10px;">
      <div class="violation-alert-title">${countLabel}</div>
      ${lines.join("")}
    </div>
  `;
}

function hideReplay() {
  stopPlayback();
  replayPanel.hidden = true;
  replayEvents = [];
  promptEventsAll = [];
  replayViolations.innerHTML = "";
  replayPrompts.innerHTML = "";
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

  renderPromptsUpTo(ev.t);
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