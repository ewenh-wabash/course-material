export function getUnitColor(avgScore) {
  const score = Math.max(0, Math.min(100, avgScore));

  if (score <= 50) {
    const t = score / 50;
    const r = Math.round(220 + (255 - 220) * t);
    const g = Math.round(53 + (193 - 53) * t);
    const b = Math.round(69 + (7 - 69) * t);
    return `rgba(${r},${g},${b},0.5)`;
  } else {
    const t = (score - 50) / 50;
    const r = Math.round(255 + (40 - 255) * t);
    const g = Math.round(193 + (167 - 193) * t);
    const b = Math.round(7 + (69 - 7) * t);
    return `rgba(${r},${g},${b},0.5)`;
  }
}


export function renderUnitCount(count, elementId) {
  count = Number(count) || 0;

  const el = document.getElementById(elementId);
  if (el) el.innerHTML = `${count}`;
}


export function renderScoreHeader(avgScore, headerId="scoresHeader", displayId="scoreAvg") {
  avgScore = Number(avgScore) || 0;

  let medal = "";
  // if (avgScore >= 100) medal = "&#128175;";
  // else if (avgScore >= 90) medal = "&#129351;";
  if (avgScore >= 90) medal = "&#129351;";
  else if (avgScore >= 80) medal = "&#129352;";
  else if (avgScore >= 70) medal = "&#129353;";

  const displayEl = document.getElementById(displayId);
  const headerEl = document.getElementById(headerId);

  if (!displayEl || !headerEl) return;

  displayEl.innerHTML = `
    <span class="me-2">Score</span>
    <span><span id="scoreAvgDisplay">${avgScore.toFixed(1)}</span>%</span>
    <span class="header-medal">${medal}</span>
  `;

  headerEl.style.setProperty(
    "background-color",
    getUnitColor(avgScore),
    "important"
  );

  headerEl.classList.add("text-dark");
}


export async function submitUnitScore({
  db,
  currentUser,
  unitId,
  unitName,
  score,
  scoreField,
  countField,
  alpha = 0.26,
  threshold = 50
}) {
  const { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const userRef = doc(db, "users", currentUser.uid);
  const docSnap = await getDoc(userRef);

  const currentScoreAvg = docSnap.exists()
    ? docSnap.data()[scoreField] || 0
    : 0;

  const newScoreAvg = alpha * score + (1 - alpha) * currentScoreAvg;

  if (score >= threshold) {
    await updateDoc(userRef, {
      totalCorrectUnits: increment(1),
      [countField]: increment(1),
      [scoreField]: newScoreAvg
    });
  } else {
    await updateDoc(userRef, {
      [scoreField]: newScoreAvg
    });
  }

  await addDoc(collection(db, "scores"), {
    uid: currentUser.uid,
    unitId,
    unitName,
    score,
    timestamp: serverTimestamp()
  });

  return newScoreAvg;
}

export function appendScoreRow(
  text,
  score,
  displayId = "pastTimes",
  threshold = 50
) {
  const container = document.getElementById(displayId);
  if (!container) return;

  const safeScore = Number(score) || 0;
  const isSuccess = safeScore >= threshold;

  const emoji = isSuccess ? "&#127942;" : "&#10060;";
  const bgColor = isSuccess
    ? getUnitColor(safeScore)
    : "transparent";

  // const row = document.createElement("span");
  // row.className = "mb-2 d-inline-block fade-in";
  const row = document.createElement("div");
  row.className = "mb-2 d-flex justify-content-between align-items-center fade-in";

  row.style.padding = "2px 4px";
  row.style.borderRadius = "3px";

  if (score === null || score === undefined) {
    row.innerHTML = `&#10060; ${text}`;
    container.appendChild(row);
    return;
  }

  if (isSuccess) {
    row.style.backgroundColor = bgColor;
  }

  row.innerHTML = `
    <span>${emoji} ${text}</span>
    <span>${safeScore.toFixed(0)}%</span>
  `;

  container.appendChild(row);
}
