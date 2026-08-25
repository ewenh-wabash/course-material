// module-loader.js
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { currentUser } from './auth.js';

export async function checkModuleAccess(db, unitName, contentDivId="moduleContent", lockedMessageId="lockedMessage") {
  const moduleContentDiv = document.getElementById(contentDivId);
  const lockedMessageDiv = document.getElementById(lockedMessageId);

  moduleContentDiv.style.display = "none";
  lockedMessageDiv.style.display = "none";

  if (!currentUser) {
    lockedMessageDiv.textContent = "Please log in to access this module.";
    lockedMessageDiv.style.display = "block";
    return false;
  }

  const userModuleDocRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userModuleDocRef);

  // TODO remove?
  if (!snap.exists()) {
    await setDoc(userModuleDocRef, { module_1: false, module_2: false, module_3: false });
  }

  const userUnits = snap.exists() ? snap.data() : {};
  // console.log(userUnits, userUnits[unitName])
  const value = userUnits[unitName];

  if (value === undefined || value === null || value === -1) {
    console.log("ACK")
    lockedMessageDiv.innerHTML = '<br/>This module is <a href="../../../nav.html" class="text-danger">locked</a> &#128274;';
    lockedMessageDiv.style.display = "block";
    lockedMessageDiv.classList.add("locked-message", "text-danger");
    return false;
  }

  moduleContentDiv.style.display = "block";
  return true;
}
