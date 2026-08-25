// layout.js

import { setupAuthUI } from './auth.js';

export function setupPage(title) {
  setupHeaderFooter(title);
  setupAuthUI();
}

export function setupHeaderFooter(headerTitle="Ear Trainer", headerId="header", footerId="footer") {

  // set title
  document.title = headerTitle;

  // set favicon
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/x-icon";
  link.href = "/favicon.ico";
  document.head.appendChild(link);

  const header = document.getElementById(headerId);
  const footer = document.getElementById(footerId);

  if (!header || !footer) return;

  header.innerHTML = `

<nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm ps-3 pe-2">
  <a class="navbar-brand" href="nav.html">${headerTitle}</a>
    <button class="navbar-toggler" type="button"
      data-bs-toggle="collapse"
      data-bs-target="#navbarContent">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarContent">
      <ul class="navbar-nav me-auto">

        <li class="nav-item">
          <a class="nav-link" href="/index.html">Home</a>
        </li>

        <li class="nav-item">
          <a class="nav-link" href="/nav.html">Modules</a>
        </li>

        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle fw-semibold"
             href="#"
             id="unitsDropdown"
             role="button"
             data-bs-toggle="dropdown"
             aria-expanded="false">
            Units
          </a>

          <ul class="dropdown-menu" aria-labelledby="unitsDropdown">
            <li><h6 class="dropdown-header">Notes & Sounds</h6></li>
            <li><a class="dropdown-item" href="/units.html?module=basicListening">Basic Listening</a></li>
            <li><a class="dropdown-item" href="/units.html?module=register">Register</a></li>
            <li><a class="dropdown-item" href="/units.html?module=intonation">Intonation</a></li>
            <li><a class="dropdown-item" href="/units.html?module=panning">Panning</a></li>
            <li><a class="dropdown-item" href="/units.html?module=dynamics">Dynamics</a></li>
            <li><a class="dropdown-item" href="/units.html?module=color">Color</a></li>
            <li><a class="dropdown-item" href="/units.html?module=envelope">Envelope</a></li>
            <hr>
            <li><h6 class="dropdown-header">Timing & Structure</h6></li>
            <li><a class="dropdown-item" href="/units.html?module=tempo">Tempo</a></li>
            <li><a class="dropdown-item" href="/units.html?module=rhythm">Rhythm</a></li>
            <li><a class="dropdown-item" href="/units.html?module=meter">Meter</a></li>
            <li><a class="dropdown-item" href="/units.html?module=form">Form</a></li>

            <hr>
            <li><h6 class="dropdown-header">Monophony</h6></li>
            <li><a class="dropdown-item" href="/units.html?module=pitch">Pitch</a></li>
            <li><a class="dropdown-item" href="/units.html?module=intervals">Intervals</a></li>
            <li><a class="dropdown-item" href="/units.html?module=scales">Scales</a></li>
            <li><a class="dropdown-item" href="/units.html?module=melody">Melody</a></li>

            <hr>
            <li><h6 class="dropdown-header">Polyphony</h6></li>
            <li><a class="dropdown-item" href="/units.html?module=triads">Triads</a></li>
            <li><a class="dropdown-item" href="/units.html?module=diatonicChordProgressions">Diatonic Chord Progressions</a></li>
            <li><a class="dropdown-item" href="/units.html?module=borrowedChordProgressions">Borrowed Chord Progressions</a></li>
            <li><a class="dropdown-item" href="/units.html?module=secondaryChordProgressions">Secondary Chord Progressions</a></li>
            <li><a class="dropdown-item" href="/units.html?module=exoticChordProgressions">Exotic Chord Progressions</a></li>

            <hr>
            <li><h6 class="dropdown-header">Style & Mode</h6></li>
            <li><a class="dropdown-item" href="/units.html?module=modes">Modes</a></li>
            <li><a class="dropdown-item" href="/units.html?module=geographicStyles">Style by Geography</a></li>
            <li><a class="dropdown-item" href="/units.html?module=styleIdentification">Style by Era</a></li>

            <hr>
            <li><a class="dropdown-item" href="/blank.html">Blank</a></li>

          </ul>
        </li>

        <li class="nav-item">
          <a class="nav-link" href="/progress.html">Progress</a>
        </li>

      </ul>
    </div>

  <div id="userInfoEmail" class="small text-light mx-2"></div>

  <div class="ms-auto dropdown">
    <img
      id="profilePic"
      src="/default_profile.webp"
      width="40"
      height="40"
      class="rounded-circle dropdown-toggle"
      role="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      style="cursor:pointer;"
    >

    <ul class="dropdown-menu dropdown-menu-end">
      <li class="px-3">
        <div id="userInfoName" class="fw-bold"></div>
      </li>
      <li class="px-3">
        <div id="userInfoEmailDropdown"></div>
      </li>
      <li class="px-3">
        <div id="totalCorrect"></div>
      </li>
      <li class="px-3">
        <div id="startDate"></div>
      </li>
      <li>
        <button id="loginBtn" class="dropdown-item">Login</button>
      </li>
      <li>
        <button id="logoutBtn" class="dropdown-item text-danger">Logout</button>
      </li>
    </ul>
  </div>
</nav>
`;

  footer.innerHTML = `
    <div class="text-center text-muted py-3 border-top mt-4">
      © ${new Date().getFullYear()} Hunter Ewen
    </div>
`;

document.body.style.backgroundImage = "url('/background.png')";
document.body.style.backgroundSize = 'cover';
document.body.style.backgroundPosition = 'center';
document.body.style.backgroundRepeat = 'no-repeat';
document.body.style.backgroundAttachment = 'fixed';
}
