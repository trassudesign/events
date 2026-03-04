/* ========= MAIN MODULE - Coordinates Quiz & Stock ========= */

import {
  startQuiz,
  setLanguage,
  currentLanguage,
  showLeaderboard,
  exportCSV,
  submitEmail,
} from "./quiz.js";
import { showStock } from "./stock.js";
import {
  showAdminPanel,
  checkAdminAuth,
  logoutAdmin,
  setupAdminDelegation,
} from "./admin.js";
import { getActiveEvent } from "./events.js";

/* ========= TEXT CONTENT FOR HOME SCREEN ========= */
const textContent = {
  pt: {
    startQuiz: "Começar Quiz",
    stock: "Ver Stock",
  },
  en: {
    startQuiz: "Start Quiz",
    stock: "See Stock",
  },
};

/* ========= DOM SETUP ========= */
const startBtn = document.getElementById("start-btn");
const stockBtn = document.getElementById("stock-btn");
const adminBtn = document.getElementById("admin-btn");
const langPT = document.getElementById("lang-pt");
const langEN = document.getElementById("lang-en");

/* ========= EVENT LISTENERS ========= */
startBtn.addEventListener("click", startQuiz);
stockBtn.addEventListener("click", showStock);
adminBtn.addEventListener("click", showAdminPanel);

langPT.addEventListener("click", () => {
  setLanguage("pt");
  updateHomeTexts();
});

langEN.addEventListener("click", () => {
  setLanguage("en");
  updateHomeTexts();
});

document.getElementById("submit-email").addEventListener("click", submitEmail);
document.getElementById("export-btn").addEventListener("click", exportCSV);
document
  .getElementById("restart-btn")
  .addEventListener("click", () => location.reload());

/* ========= LANGUAGE TEXT UPDATES ========= */
let activeEvent = null;

async function initBranding() {
  activeEvent = await getActiveEvent();
  updateHomeBranding();
}

function updateHomeBranding() {
  const mainLogo = document.getElementById("main-event-logo");
  const stockLogo = document.getElementById("stock-event-logo");

  const defaultLogo = "images/acf-logo.png";
  const activeLogo = activeEvent && activeEvent.logo_url ? activeEvent.logo_url : defaultLogo;

  if (mainLogo) mainLogo.src = activeLogo;
  if (stockLogo) stockLogo.src = activeLogo;

  updateHomeTexts();
}

function updateHomeTexts() {
  startBtn.textContent = textContent[currentLanguage].startQuiz;

  const stockBaseText = textContent[currentLanguage].stock;
  const eventName = activeEvent ? ` ${activeEvent.name}` : "";
  stockBtn.textContent = `${stockBaseText}${eventName}`;
}

/* ========= INITIALIZE ========= */
checkAdminAuth();
setupAdminDelegation();
initBranding();
