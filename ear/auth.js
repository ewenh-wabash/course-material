// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export let currentUser = null;

// Firebase config & initialization
const firebaseConfig = {
  apiKey: "AIzaSyCygLMRUJuf6pxIRD7rmKGNZ5k-FhJWi3U",
  authDomain: "test-quiz-a125a.firebaseapp.com",
  projectId: "test-quiz-a125a",
  storageBucket: "test-quiz-a125a.firebasestorage.app",
  messagingSenderId: "211214067673",
  appId: "1:211214067673:web:8ed8bc612609cfa2085bc8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Attach login/logout buttons and manage UI
export function setupAuthUI(loginBtnId = "loginBtn",
                            logoutBtnId = "logoutBtn",
                            userInfoName = "userInfoName",
                            userInfoEmail = "userInfoEmail",
                            userInfoEmailDropdown = "userInfoEmailDropdown",
                            totalCorrect = "totalCorrect",
                            startDate = "startDate",
                            profilePicId = "profilePic") {

  const loginBtn = document.getElementById(loginBtnId);
  const logoutBtn = document.getElementById(logoutBtnId);
  const userEmail = document.getElementById(userInfoEmail);
  const userEmailDropdown = document.getElementById(userInfoEmailDropdown);
  const userTotalUnits = document.getElementById(totalCorrect);
  const userStartDate = document.getElementById(startDate);
  const userName = document.getElementById(userInfoName);
  const profilePic = document.getElementById(profilePicId);

  if (!loginBtn || !logoutBtn || !userName || !userEmail) {
    console.error("setupAuthUI: missing DOM elements");
    console.error("1111", loginBtn);
    console.error("2222", logoutBtn);
    console.error("3333", userName);
    console.error("4444", userEmail);
    return null;
  }

  const auth = getAuth();
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account'
  });

  // attach click handlers
  loginBtn.onclick = async () => { await signInWithPopup(auth, provider); };
  logoutBtn.onclick = async () => { await signOut(auth); };

  // handle state changes
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (!user) {
      loginBtn.style.display = "inline";
      logoutBtn.style.display = "none";
      // userInfo.innerHTML = "";
      userName.innerHTML = "";
      userEmail.innerHTML = `<a href="#" id="loginLink" class="text-light text-decoration-underline">login to start</a>`;
      userEmailDropdown.innerHTML = "";
      userTotalUnits.innerHTML = "";
      userStartDate.innerHTML = "";

      const loginLink = document.getElementById("loginLink");

      loginLink.onclick = (e) => {
        e.preventDefault();
        loginBtn.click();
      };

      if (profilePic) profilePic.src = "/default_profile.webp";
      return;
    }

    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline";
    userName.innerHTML = user.displayName;
    userEmail.innerHTML = user.email;
    userEmailDropdown.innerHTML = user.email;

    const db = getFirestore();
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const totalCorrectUnits = userData.totalCorrectUnits || 0;
    userTotalUnits.innerHTML = `<hr class="dropdown-divider">&#127942; <span id="totalCompleteUnits">${totalCorrectUnits}</span> complete units`;
    userStartDate.innerHTML = `Training since ${formatMMDDYY(user.metadata.creationTime)}<li><hr class="dropdown-divider"></li>`;
    if (profilePic) profilePic.src = user.photoURL;
  });
  return auth;
}

function formatMMDDYY(ts) {
  let date;
  if (ts.toDate) {
    date = ts.toDate();
  } else {
    date = new Date(ts);
  }
  const mm = String(date.getMonth() + 1); // .padStart(2, "0")
  const dd = String(date.getDate()); // .padStart(2, "0")
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}
