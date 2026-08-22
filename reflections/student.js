import { auth, db } from "./firebase-config.js";
import { assignments as assignmentList, slugify } from "./assignments.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------------------------------------------------------------
// Elements
// ---------------------------------------------------------------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authError = document.getElementById("auth-error");
const modeSignIn = document.getElementById("mode-signin");
const modeSignUp = document.getElementById("mode-signup");
const whoEmail = document.getElementById("who-email");
const signoutBtn = document.getElementById("signout-btn");

const pickerPanel = document.getElementById("picker-panel");
const assignmentSelect = document.getElementById("assignment-select");
const startBtn = document.getElementById("start-btn");

const submittedView = document.getElementById("submitted-view");
const submittedTitle = document.getElementById("submitted-title");
const submittedText = document.getElementById("submitted-text");

const writingView = document.getElementById("writing-view");
const writingTitle = document.getElementById("writing-title");
const editor = document.getElementById("editor");
const wordCountEl = document.getElementById("word-count");
const submitBtn = document.getElementById("submit-btn");

const timerRingWrap = document.getElementById("timer-ring-wrap");
const timerRingFg = document.getElementById("timer-ring-fg");
const timerLabel = document.getElementById("timer-label");
const timerStatusWord = document.getElementById("timer-status-word");
const timerStatusSub = document.getElementById("timer-status-sub");

const lockdownOverlay = document.getElementById("lockdown-overlay");
const lockdownMessage = document.getElementById("lockdown-message");
const lockdownReturnBtn = document.getElementById("lockdown-return-btn");

const webcamPreview = document.getElementById("webcam-preview");
let webcamStream = null;

const promptBtn = document.getElementById("prompt-btn");
const promptDisplay = document.getElementById("prompt-display");

const addPromptPanel = document.getElementById("add-prompt-panel");
const newPromptInput = document.getElementById("new-prompt-input");
const addPromptBtn = document.getElementById("add-prompt-btn");
const addPromptStatus = document.getElementById("add-prompt-status");

const RING_CIRCUMFERENCE = 2 * Math.PI * 34; // matches r=34 in svg

// ---------------------------------------------------------------
// Webcam preview — just a live feed of the student's own camera,
// shown at the top of the page. Nothing is recorded, streamed, or
// stored anywhere; it never leaves the browser.
// ---------------------------------------------------------------
async function startWebcamPreview() {
  if (webcamStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    webcamPreview.hidden = true;
    return;
  }
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    webcamPreview.srcObject = webcamStream;
    webcamPreview.hidden = false;
  } catch (err) {
    console.warn("Webcam preview unavailable:", err);
    webcamPreview.hidden = true;
  }
}

function stopWebcamPreview() {
  if (webcamStream) {
    webcamStream.getTracks().forEach((track) => track.stop());
    webcamStream = null;
  }
  webcamPreview.srcObject = null;
  webcamPreview.hidden = true;
}

// ---------------------------------------------------------------
// Fullscreen + focus lockdown
//
// Browsers won't let a page truly force fullscreen, block Escape, or
// prevent a tab from being closed — that's intentional browser security,
// not something JS can override. What we do instead:
//
//   - Request fullscreen the moment a reflection starts (a real click is
//     required for the browser to allow it).
//   - If fullscreen is exited, the tab/app is switched away from, or the
//     window loses focus while a reflection is active, we immediately
//     submit whatever text exists at that instant, flag it with a
//     timestamped reason, and lock the editor. There is no "resume" —
//     leaving is the thing that ends the reflection.
//   - Reload/close/navigate triggers the browser's native "leave this
//     page?" confirmation. If they proceed anyway, the next time they
//     sign back in, any reflection left in-progress is finalized the
//     same way (flagged, submitted as-is) rather than resumed.
//
// The one place a click is used to *re-enter* something is the very
// first fullscreen request, if the browser initially blocks it — that's
// not a "left and came back", it's just the initial permission handshake.
// ---------------------------------------------------------------

async function requestFullscreenSafe() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) await el.msRequestFullscreen();
  } catch (err) {
    console.warn("Fullscreen request failed:", err);
  }
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

// mode: "retry-entry" (initial fullscreen permission handshake, retry allowed)
//    or "terminal" (reflection has already been auto-submitted, dead end)
function showLockdown(message, mode) {
  lockdownMessage.textContent = message;
  lockdownReturnBtn.textContent = mode === "terminal" ? "OK" : "Try fullscreen again";
  lockdownOverlay.dataset.mode = mode;
  lockdownOverlay.hidden = false;
}

function hideLockdown() {
  lockdownOverlay.hidden = true;
}

lockdownReturnBtn.addEventListener("click", async () => {
  if (lockdownOverlay.dataset.mode === "terminal") {
    hideLockdown();
    teardownSession();
    assignmentSelect.value = "";
    return;
  }
  // retry-entry: attempt fullscreen again; leave the overlay up if it still fails.
  await requestFullscreenSafe();
  if (isFullscreen()) {
    if (session) session.armedAt = Date.now() + 1200;
    hideLockdown();
  }
});

let finalizing = false;

async function finalizeAsViolation(type, humanMessage) {
  if (!session || finalizing) return;
  if (session.armedAt && Date.now() < session.armedAt) return; // grace period right after entry
  finalizing = true;

  try {
    const s = session;
    if (s.flushTimer) clearInterval(s.flushTimer);
    if (s.tickTimer) clearInterval(s.tickTimer);
    if (s.minuteSyncTimer) clearInterval(s.minuteSyncTimer);

    await flushBuffer(true);

    try {
      await updateDoc(doc(db, "submissions", s.submissionId), {
        finalText: editor.value,
        currentText: editor.value,
        submittedAt: serverTimestamp(),
        status: "submitted",
        violations: arrayUnion({ type, t: Date.now() }),
      });
    } catch (err) {
      console.error("Auto-submit on violation failed:", err);
    }

    editor.disabled = true;
    submitBtn.disabled = true;
    session = null;

    if (isFullscreen() && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    writingView.hidden = true;
    showLockdown(humanMessage, "terminal");
  } finally {
    finalizing = false;
  }
}

const VIOLATION_MESSAGES = {
  "fullscreen-exit":
    "You exited fullscreen, so your reflection was submitted early — exactly as it was at that moment. This has been flagged for your teacher.",
  "tab-hidden":
    "You left this tab or minimized the window, so your reflection was submitted early — exactly as it was at that moment. This has been flagged for your teacher.",
  "window-blur":
    "This window lost focus, so your reflection was submitted early — exactly as it was at that moment. This has been flagged for your teacher.",
};

document.addEventListener("fullscreenchange", () => {
  if (!isFullscreen()) finalizeAsViolation("fullscreen-exit", VIOLATION_MESSAGES["fullscreen-exit"]);
});
["webkitfullscreenchange", "msfullscreenchange"].forEach((evt) => {
  document.addEventListener(evt, () => {
    if (!isFullscreen()) finalizeAsViolation("fullscreen-exit", VIOLATION_MESSAGES["fullscreen-exit"]);
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) finalizeAsViolation("tab-hidden", VIOLATION_MESSAGES["tab-hidden"]);
});

window.addEventListener("blur", () => {
  finalizeAsViolation("window-blur", VIOLATION_MESSAGES["window-blur"]);
});

// Suppress Escape and the bare Meta/Ctrl (Cmd/Windows key) keydown while a
// reflection is active. Two things this genuinely cannot do, by
// browser/OS design: it cannot stop Escape from exiting fullscreen (that
// specific behavior is deliberately un-preventable, so no page can trap
// someone in fullscreen), and it cannot intercept OS-level app-switching
// shortcuts like Cmd+Tab/Alt+Tab — those never reach the page's JS at
// all. Both are still caught anyway, just via a different route: exiting
// fullscreen or losing window focus (which app-switching causes either
// way) already triggers the flagged auto-submit above. This does not
// block Cmd/Ctrl+letter combos like undo or select-all, so normal
// editing still works while writing.
document.addEventListener(
  "keydown",
  (e) => {
    console.log(e)
    if (!session) return;
    if ((e.metaKey === true) && (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  { capture: true }
);

// ---------------------------------------------------------------
// Auth screen wiring
// ---------------------------------------------------------------
let authMode = "signin";

modeSignIn.addEventListener("click", () => {
  authMode = "signin";
  modeSignIn.classList.add("active");
  modeSignUp.classList.remove("active");
  authSubmitBtn.textContent = "Sign in";
});
modeSignUp.addEventListener("click", () => {
  authMode = "signup";
  modeSignUp.classList.add("active");
  modeSignIn.classList.remove("active");
  authSubmitBtn.textContent = "Create account";
});

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
    if (authMode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = friendlyAuthError(err);
    authError.hidden = false;
  }
});

function friendlyAuthError(err) {
  const code = err.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Incorrect email or password.";
  if (code.includes("user-not-found")) return "No account with that email. Try 'Create account'.";
  if (code.includes("email-already-in-use")) return "That email already has an account. Try 'Sign in'.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  return "Something went wrong. Please try again.";
}

signoutBtn.addEventListener("click", () => {
  teardownSession();
  stopWebcamPreview();
  signOut(auth);
});

// ---------------------------------------------------------------
// Auth state -> app bootstrap
// ---------------------------------------------------------------
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    whoEmail.textContent = user.email;
    loadAssignments();
    startWebcamPreview();
    await finalizeAnyAbandonedSession();
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
    stopWebcamPreview();
  }
});

// ---------------------------------------------------------------
// Assignment picker
// ---------------------------------------------------------------
let assignmentsById = {};

function loadAssignments() {
  assignmentSelect.innerHTML = `<option value="">Select…</option>`;
  assignmentSelect.disabled = false;
  startBtn.hidden = true;
  assignmentsById = {};
  assignmentList.forEach((a) => {
    const id = slugify(a.name);
    assignmentsById[id] = { id, title: a.name, timerMinutes: a.length, prompts: a.prompts || [] };
  });
  const sorted = Object.values(assignmentsById).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
  sorted.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.title} (${a.timerMinutes} min)`;
    assignmentSelect.appendChild(opt);
  });
  if (sorted.length === 0) {
    assignmentSelect.innerHTML = `<option value="">No assignments available yet</option>`;
  }
}

// ---------------------------------------------------------------
// Prompts: built-in (from assignments.js) + community-submitted
// (from Firestore, added by students after they submit).
// ---------------------------------------------------------------
const communityPromptsByAssignment = {}; // id -> string[] (cached once fetched)

// Kick off (or reuse a cached) fetch of community prompts for an
// assignment. Called as soon as a film is picked, so the list is
// ready by the time "Start" is clicked.
function ensureCommunityPromptsLoaded(assignmentId) {
  if (communityPromptsByAssignment[assignmentId]) return communityPromptsByAssignment[assignmentId];
  const promise = (async () => {
    try {
      const q = query(collection(db, "promptSubmissions"), where("assignmentId", "==", assignmentId));
      const snap = await getDocs(q);
      const texts = [];
      snap.forEach((d) => {
        const text = (d.data().text || "").trim();
        if (text) texts.push(text);
      });
      return texts;
    } catch (err) {
      console.error("Couldn't load community prompts:", err);
      return [];
    }
  })();
  communityPromptsByAssignment[assignmentId] = promise;
  return promise;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reshuffle the pool once it's been exhausted, without letting the
// prompt that was just shown immediately repeat as the next one.
function reshufflePromptPool(sess) {
  const lastShown = sess.promptPool[sess.promptPool.length - 1];
  let reshuffled = shuffle(sess.promptPool);
  if (reshuffled.length > 1 && reshuffled[0] === lastShown) {
    [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
  }
  sess.promptPool = reshuffled;
  sess.promptCursor = 0;
}

// There's no "resume" for an in-progress reflection — leaving it (however
// that happened) is what ends it. If a submission is still marked
// in_progress on load, that means a previous browser session ended
// without a normal Submit click (most likely reload/close, since a live
// blur/visibility/fullscreen exit already auto-submits it in real time).
// Finalize it the same way: flagged, submitted exactly as last synced.
// Sweep ALL of them in one pass — if this only handled one at a time,
// leftover stale sessions (e.g. from earlier testing) would surface
// confusingly across separate reloads, seemingly for the wrong assignment.
async function finalizeAnyAbandonedSession() {
  const finalizedTitles = [];

  for (const id of Object.keys(assignmentsById)) {
    const submissionId = `${id}_${currentUser.uid}`;
    const ref = doc(db, "submissions", submissionId);
    const subSnap = await getDoc(ref);
    if (subSnap.exists() && subSnap.data().status === "in_progress") {
      const data = subSnap.data();
      try {
        await updateDoc(ref, {
          finalText: data.currentText || "",
          submittedAt: serverTimestamp(),
          status: "submitted",
          violations: arrayUnion({ type: "left-without-submitting", t: Date.now() }),
        });
        finalizedTitles.push(assignmentsById[id].title);
      } catch (err) {
        console.error("Couldn't finalize abandoned session:", err);
      }
    }
  }

  if (finalizedTitles.length === 1) {
    showLockdown(
      `Your previous attempt at "${finalizedTitles[0]}" was submitted early because you left the reflection screen before finishing. This has been flagged for your teacher.`,
      "terminal"
    );
  } else if (finalizedTitles.length > 1) {
    showLockdown(
      `${finalizedTitles.length} previous reflection attempts (${finalizedTitles
        .map((t) => `"${t}"`)
        .join(", ")}) were submitted early because you left before finishing. These have been flagged for your teacher.`,
      "terminal"
    );
  }

  return finalizedTitles.length > 0;
}

// Tracks which assignment the currently-visible submitted-view (and its
// "add a prompt" panel) belongs to, so the add-prompt handler knows where
// to file a new prompt.
let submittedViewAssignmentId = null;

function showSubmittedView(assignmentId, data) {
  submittedViewAssignmentId = assignmentId;
  submittedTitle.textContent = assignmentsById[assignmentId].title;
  submittedText.textContent = data.finalText || "";
  submittedView.hidden = false;
  addPromptPanel.hidden = false;
  newPromptInput.value = "";
  addPromptStatus.hidden = true;
}

assignmentSelect.addEventListener("change", async () => {
  const assignmentId = assignmentSelect.value;
  teardownSession();
  assignmentSelect.disabled = false;
  startBtn.hidden = true;
  if (!assignmentId) return;

  // Warm the community-prompts cache for this film right away so it's
  // ready by the time the student clicks Start.
  ensureCommunityPromptsLoaded(assignmentId);

  const submissionId = `${assignmentId}_${currentUser.uid}`;
  const subSnap = await getDoc(doc(db, "submissions", submissionId));

  if (subSnap.exists() && subSnap.data().status === "submitted") {
    showSubmittedView(assignmentId, subSnap.data());
    return;
  }

  if (subSnap.exists() && subSnap.data().status === "in_progress") {
    // Shouldn't normally happen (abandoned sessions are swept on load),
    // but handle it defensively the same way — finalize, don't resume.
    const data = subSnap.data();
    try {
      await updateDoc(doc(db, "submissions", submissionId), {
        finalText: data.currentText || "",
        submittedAt: serverTimestamp(),
        status: "submitted",
        violations: arrayUnion({ type: "left-without-submitting", t: Date.now() }),
      });
    } catch (err) {
      console.error("Couldn't finalize stale in-progress session:", err);
    }
    showLockdown(
      `Your previous attempt at "${assignmentsById[assignmentId].title}" was submitted early because you left the reflection screen before finishing. This has been flagged for your teacher.`,
      "terminal"
    );
    return;
  }

  // Not started yet — require an explicit Start click before the timer runs.
  startBtn.hidden = false;
});

startBtn.addEventListener("click", async () => {
  const assignmentId = assignmentSelect.value;
  if (!assignmentId) return;
  startBtn.hidden = true;
  assignmentSelect.disabled = true;
  await openAssignment(assignmentId);
  await requestFullscreenSafe();
  if (isFullscreen()) {
    if (session) session.armedAt = Date.now() + 1200;
  } else {
    showLockdown(
      "Your browser blocked fullscreen. Click below to try again — this reflection must be completed in fullscreen.",
      "retry-entry"
    );
  }
});

// ---------------------------------------------------------------
// Session state (per opened assignment)
// ---------------------------------------------------------------
let session = null; // { assignmentId, submissionId, startedAtMs, timerMinutes, buffer, flushTimer, tickTimer, minuteSyncTimer, armedAt }

function teardownSession() {
  if (session) {
    if (session.flushTimer) clearInterval(session.flushTimer);
    if (session.tickTimer) clearInterval(session.tickTimer);
    if (session.minuteSyncTimer) clearInterval(session.minuteSyncTimer);
    flushBuffer(true); // best-effort final flush
  }
  session = null;
  writingView.hidden = true;
  submittedView.hidden = true;
  addPromptPanel.hidden = true;
  submittedViewAssignmentId = null;
  startBtn.hidden = true;
  hideLockdown();
  editor.value = "";
  editor.removeEventListener("input", onEditorInput);
  promptDisplay.hidden = true;
  promptDisplay.textContent = "";
  // Always leave the picker interactive after tearing a session down —
  // whatever flow disabled the dropdown is responsible for re-disabling
  // it if it's about to start a new one.
  assignmentSelect.disabled = false;
}

async function openAssignment(assignmentId) {
  const assignment = assignmentsById[assignmentId];
  if (!assignment) return;

  const submissionId = `${assignmentId}_${currentUser.uid}`;
  const subRef = doc(db, "submissions", submissionId);
  const subSnap = await getDoc(subRef);

  if (subSnap.exists() && subSnap.data().status === "submitted") {
    // Already turned in — read only view
    showSubmittedView(assignmentId, subSnap.data());
    return;
  }

  const startTs = Timestamp.now();
  await setDoc(subRef, {
    assignmentId,
    uid: currentUser.uid,
    studentEmail: currentUser.email,
    startedAt: startTs,
    currentText: "",
    status: "in_progress",
    lastSyncedAt: startTs,
  });

  const communityPrompts = await ensureCommunityPromptsLoaded(assignmentId);
  const combinedPrompts = [...(assignment.prompts || []), ...communityPrompts];

  session = {
    assignmentId,
    submissionId,
    startedAtMs: startTs.toMillis(),
    timerMinutes: assignment.timerMinutes,
    buffer: [],
    armedAt: 0,
    promptPool: shuffle(combinedPrompts),
    promptCursor: 0,
  };

  writingTitle.textContent = assignment.title;
  editor.value = "";
  editor.disabled = false;
  submitBtn.disabled = true;
  updateWordCount();
  writingView.hidden = false;
  promptDisplay.hidden = true;
  promptDisplay.textContent = "";
  promptBtn.disabled = session.promptPool.length === 0;
  promptBtn.title = session.promptPool.length === 0 ? "No prompts available for this film yet" : "";

  editor.addEventListener("input", onEditorInput);

  // Record the initial state as the first event too, so replay has a t0 anchor.
  session.buffer.push({ t: Date.now(), text: "" });

  // Flush the keystroke buffer to Firestore every 6 seconds.
  session.flushTimer = setInterval(() => flushBuffer(false), 6000);

  // Update the durable "current text" snapshot on the submission doc every 60s
  // as a crash-safety net (separate from the fine-grained history log).
  session.minuteSyncTimer = setInterval(() => syncCurrentTextSnapshot(), 60000);

  // Timer tick every second.
  session.tickTimer = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

// ---------------------------------------------------------------
// Editor: capture + block copy/paste/cut
// ---------------------------------------------------------------
["paste", "cut", "copy", "contextmenu", "drop", "dragstart"].forEach((evt) => {
  editor.addEventListener(evt, (e) => e.preventDefault());
});

function onEditorInput() {
  if (!session) return;
  session.buffer.push({ t: Date.now(), text: editor.value });
  updateWordCount();
}

// ---------------------------------------------------------------
// Prompt button — shows a random (shuffled, non-repeating) prompt
// and records the press + which prompt was shown on the submission
// doc, the same way violations are recorded, so it shows up in the
// admin replay view.
// ---------------------------------------------------------------
promptBtn.addEventListener("click", () => {
  if (!session || !session.promptPool || session.promptPool.length === 0) return;
  if (session.promptCursor >= session.promptPool.length) {
    reshufflePromptPool(session);
  }
  const prompt = session.promptPool[session.promptCursor];
  session.promptCursor++;

  promptDisplay.textContent = prompt;
  promptDisplay.hidden = false;

  recordPromptEvent(prompt);
});

async function recordPromptEvent(prompt) {
  if (!session) return;
  try {
    await updateDoc(doc(db, "submissions", session.submissionId), {
      promptEvents: arrayUnion({ t: Date.now(), prompt }),
    });
  } catch (err) {
    console.error("Couldn't record prompt event:", err);
  }
}

function updateWordCount() {
  const words = editor.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------
// Sync: flush keystroke buffer as a batch to the history subcollection
// ---------------------------------------------------------------
async function flushBuffer(isFinal) {
  if (!session || session.buffer.length === 0) return;
  const events = session.buffer.splice(0, session.buffer.length);
  const historyRef = collection(db, "submissions", session.submissionId, "history");
  try {
    await addDoc(historyRef, {
      events,
      batchStart: events[0].t,
      batchEnd: events[events.length - 1].t,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Put events back so we retry on the next flush.
    session.buffer.unshift(...events);
    console.error("Flush failed, will retry:", err);
  }
}

async function syncCurrentTextSnapshot() {
  if (!session) return;
  try {
    await updateDoc(doc(db, "submissions", session.submissionId), {
      currentText: editor.value,
      lastSyncedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Snapshot sync failed:", err);
  }
}

// ---------------------------------------------------------------
// Timer
// ---------------------------------------------------------------
function updateTimerDisplay() {
  if (!session) return;
  const totalMs = session.timerMinutes * 60 * 1000;
  const elapsed = Date.now() - session.startedAtMs;
  const remaining = Math.max(0, totalMs - elapsed);
  const unlocked = remaining <= 0;

  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  timerLabel.textContent = unlocked ? "Ready" : `${mm}:${ss}`;

  const progress = Math.min(1, elapsed / totalMs);
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  timerRingFg.style.strokeDashoffset = offset;

  if (unlocked) {
    timerRingWrap.classList.remove("locked");
    timerRingWrap.classList.add("unlocked");
    timerStatusWord.textContent = "Ready to submit";
    timerStatusWord.classList.add("unlocked");
    timerStatusSub.textContent = "Whenever you're ready, submit your reflection below.";
    submitBtn.disabled = false;
    clearInterval(session.tickTimer);
    session.tickTimer = null;
  } else {
    timerStatusSub.textContent = "Take your time. The submit button unlocks when the timer ends.";
  }
}

// ---------------------------------------------------------------
// Submit
// ---------------------------------------------------------------
submitBtn.addEventListener("click", async () => {
  if (!session) return;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  await flushBuffer(true);
  try {
    await updateDoc(doc(db, "submissions", session.submissionId), {
      finalText: editor.value,
      currentText: editor.value,
      submittedAt: serverTimestamp(),
      status: "submitted",
    });
    editor.disabled = true;
    submitBtn.textContent = "Submitted";
    if (session.flushTimer) clearInterval(session.flushTimer);
    if (session.minuteSyncTimer) clearInterval(session.minuteSyncTimer);
    const finishedAssignmentId = session.assignmentId;
    const finalText = editor.value;
    session = null;
    hideLockdown();
    assignmentSelect.disabled = false;
    if (isFullscreen() && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    writingView.hidden = true;
    showSubmittedView(finishedAssignmentId, { finalText });
  } catch (err) {
    console.error(err);
    submitBtn.textContent = "Submit reflection";
    submitBtn.disabled = false;
    alert("Couldn't submit — check your connection and try again.");
  }
});

// ---------------------------------------------------------------
// Add a prompt for other students (only available once the
// student has submitted their own reflection for this film).
// They can add as many as they like, one at a time.
// ---------------------------------------------------------------
addPromptBtn.addEventListener("click", async () => {
  const assignmentId = submittedViewAssignmentId;
  const text = newPromptInput.value.trim();
  if (!assignmentId) return;
  if (!text) {
    addPromptStatus.textContent = "Write something first.";
    addPromptStatus.hidden = false;
    return;
  }
  addPromptBtn.disabled = true;
  addPromptStatus.hidden = true;
  try {
    await addDoc(collection(db, "promptSubmissions"), {
      assignmentId,
      text,
      createdAt: serverTimestamp(),
      addedByUid: currentUser.uid,
      addedByEmail: currentUser.email,
    });
    // Keep the local cache in sync so this prompt is immediately eligible
    // if the same student starts another film's reflection this session.
    const cached = communityPromptsByAssignment[assignmentId];
    if (cached) {
      communityPromptsByAssignment[assignmentId] = Promise.resolve(cached).then((list) => [...list, text]);
    }
    newPromptInput.value = "";
    addPromptStatus.textContent = "Added! Feel free to add another.";
    addPromptStatus.hidden = false;
  } catch (err) {
    console.error("Couldn't add prompt:", err);
    addPromptStatus.textContent = "Couldn't add that prompt — check your connection and try again.";
    addPromptStatus.hidden = false;
  } finally {
    addPromptBtn.disabled = false;
  }
});

newPromptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addPromptBtn.click();
  }
});

// Trigger the browser's native "leave site?" confirmation while a reflection
// is in progress. Modern browsers force this to a generic message — no site
// can customize that text — but the confirmation prompt itself still fires.
// If the student proceeds anyway, the abandoned in-progress submission gets
// finalized (flagged) the next time they sign back in.
window.addEventListener("beforeunload", (e) => {
  if (session) {
    flushBuffer(true);
    e.preventDefault();
    e.returnValue = "";
  }
});