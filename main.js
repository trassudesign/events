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
import { showAdminPanel, checkAdminAuth, logoutAdmin, setupAdminDelegation } from "./admin.js";
import { getActiveEvent } from "./events.js";
import { showScreen } from "./utils.js";

/* ========= TEXT CONTENT FOR HOME SCREEN & GLOBAL UI ========= */
export const textContent = {
  pt: {
    startQuiz: "Começar Quiz",
    stock: "Ver Stock",
    storeTitle: "Temos ainda mais modelos na nossa loja online! Espreita cada modelo",
    storeBtn: "Visitar Loja Online",
    fullStoreTitle: "Todos os Modelos",
    backHome: "Voltar ao início",
    searchPlaceholder: "Pesquisar produto...",
    fullStoreSearchPlaceholder: "Pesquisar produto na loja...",
    fullStoreInfo: "Clica em qualquer modelo para veres os detalhes na nossa loja",
    qrInstruction: "Digitalize para ver na loja online",
    categories: {
      all: "Tudo",
      cars: "Carros",
      bikes: "Motos",
      tracks: "Circuitos",
      helmets: "Capacetes"
    },
    inEventStock: "em stock no evento",
    fromPrice: "desde",
    loadingStock: "A carregar o stock...",
    loadingStore: "A carregar a loja completa...",
    noResults: "Nenhum produto encontrado",
    errorLoading: "Erro ao carregar"
  },
  en: {
    startQuiz: "Start Quiz",
    stock: "See Stock",
    storeTitle: "We have even more models in our online store! Check every model",
    storeBtn: "Visit Online Store",
    fullStoreTitle: "All Models",
    backHome: "Back to Home",
    searchPlaceholder: "Search for a product...",
    fullStoreSearchPlaceholder: "Search for a product in the store...",
    fullStoreInfo: "Click on any model to see the details in our store",
    qrInstruction: "Scan to view in our online store",
    categories: {
      all: "All",
      cars: "Cars",
      bikes: "Bikes",
      tracks: "Tracks",
      helmets: "Helmets"
    },
    inEventStock: "in event stock",
    fromPrice: "from",
    loadingStock: "Loading stock...",
    loadingStore: "Loading full store...",
    noResults: "No products found",
    errorLoading: "Error loading"
  },
};

/* ========= DOM SETUP ========= */
const startBtn = document.getElementById("start-btn");
const stockBtn = document.getElementById("stock-btn");
const storeBtn = document.getElementById("store-btn");
const storeText = document.getElementById("store-text");
const langPT = document.getElementById("lang-pt");
const langEN = document.getElementById("lang-en");

/* ========= EVENT LISTENERS ========= */
startBtn.addEventListener("click", startQuiz);
stockBtn.addEventListener("click", () => {
  location.hash = "#stock";
});
if (storeBtn) {
  storeBtn.addEventListener("click", () => {
    location.hash = "#/full-store";
  });
}

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
  const homeScreen = document.getElementById("home-screen");

  const defaultLogo = "images/acf-logo.png";
  const activeLogo = activeEvent && activeEvent.logo_url ? activeEvent.logo_url : defaultLogo;

  if (mainLogo) mainLogo.src = activeLogo;
  if (stockLogo) stockLogo.src = activeLogo;

  // Toggle Quiz Visibility
  if (activeEvent && activeEvent.show_quiz === false) {
    homeScreen.classList.add("home-quiz-hidden");
  } else {
    homeScreen.classList.remove("home-quiz-hidden");
  }

  // Toggle Online Store Visibility
  if (activeEvent && activeEvent.show_online_store === false) {
    homeScreen.classList.add("home-online-store-hidden");
  } else {
    homeScreen.classList.remove("home-online-store-hidden");
  }

  updateHomeTexts();
}

function updateHomeTexts() {
  const texts = textContent[currentLanguage];
  if (startBtn) startBtn.textContent = texts.startQuiz;

  if (stockBtn) {
    const stockBaseText = texts.stock;
    const eventName = activeEvent ? ` ${activeEvent.name}` : "";
    stockBtn.textContent = `${stockBaseText}${eventName}`;
  }

  if (storeBtn) storeBtn.textContent = texts.storeBtn;
  if (storeText) storeText.textContent = texts.storeTitle;
}

/* ========= ROUTING ========= */

async function handleRoute() {
  const hash = location.hash;
  console.log("Routing to:", hash);

  if (!hash || hash === "#" || hash === "#/") {
    const home = document.getElementById("home-screen");
    if (home) showScreen(home);
  } else if (hash === "#stock") {
    showStock();
  } else if (hash === "#/full-store") {
    import("./stock.js").then(m => m.showFullStore());
  } else if (hash === "#admin") {
    showAdminPanel();
  }
}

window.addEventListener("hashchange", handleRoute);

/* ========= INITIALIZE ========= */
checkAdminAuth();
handleRoute();
setupAdminDelegation();
initBranding();
