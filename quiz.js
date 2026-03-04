/* ========= QUIZ MODULE ========= */

import { showScreen } from "./utils.js";

/* ========= CONFIG ========= */
export const totalTimePerQuestion = 20; // seconds
export const feedbackDelay = 2500; // ms before next question
export const feedbackVisibleTime = 2500; // popup visibility duration

/* ========= STATE ========= */
export let currentQuestion = 0;
export let score = 0;
export let totalTime = 0;
export let correctAnswers = 0;
let questionStartTs = 0;
let timeoutIdForAutoAdvance = null;
let colorChangeTimeouts = [];

/* ========= LANGUAGE ========= */
export let currentLanguage = "pt";

export const messages = {
  pt: {
    noCorrect: "Obrigado por participar! Vais conseguir melhor da próxima 😄",
    score: (correct, total) => `Acertaste ${correct} de ${total} perguntas!`,
    fillNameEmail: "Preencha nome e email!",
    timeout: "Ficaste sem tempo!",
    points: "+{points} pontos",
    timeSpent: "Demoraste {time}s",
  },
  en: {
    noCorrect: "Thanks for playing! You'll do better next time 😄",
    score: (correct, total) =>
      `You got ${correct} out of ${total} questions right!`,
    fillNameEmail: "Please fill name and email!",
    timeout: "Time's up!",
    points: "+{points} points",
    timeSpent: "You spent {time}s",
  },
};

/* ========= QUESTIONS (loaded from questions.json) ========= */
let questionsData = null;

async function loadQuestions() {
  if (questionsData) return questionsData;
  try {
    const res = await fetch("./questions.json");
    questionsData = await res.json();
    return questionsData;
  } catch (err) {
    console.error("Failed to load questions:", err);
    return { pt: [], en: [] };
  }
}

/* ========= DOM REFS ========= */
const quizScreen = document.getElementById("quiz-screen");
const emailPopup = document.getElementById("email-popup");
const questionImg = document.getElementById("question-img");
const questionText = document.getElementById("question-text");
const optionsGrid = document.getElementById("options-grid");
const timerFill = document.getElementById("timer-fill");
const questionContainer = document.getElementById("question-container");
const playerNameInput = document.getElementById("player-name");
const playerEmailInput = document.getElementById("player-email");
const leaderboardList = document.getElementById("leaderboard-list");
const resultMessage = document.getElementById("result-message");
const feedbackLayer = document.getElementById("feedback-layer");

/* ========= UTILITY FUNCTIONS ========= */
export function setLanguage(lang) {
  currentLanguage = lang;
  const langPT = document.getElementById("lang-pt");
  const langEN = document.getElementById("lang-en");

  if (lang === "pt") {
    langPT.classList.add("active");
    langEN.classList.remove("active");
  } else {
    langEN.classList.add("active");
    langPT.classList.remove("active");
  }
}

function showFeedbackBubble(lines = [], topOffsetPx = 180) {
  const wrapper = document.createElement("div");
  wrapper.className = "feedback-bubble";
  wrapper.style.top = topOffsetPx + "px";
  wrapper.innerHTML = lines
    .map((l) => `<div class="feedback-line">${l}</div>`)
    .join("");
  feedbackLayer.appendChild(wrapper);

  requestAnimationFrame(() => (wrapper.style.opacity = "1"));

  setTimeout(() => {
    wrapper.style.opacity = "0";
    wrapper.style.transform = "translate(-50%, -70px) scale(0.98)";
    setTimeout(() => wrapper.remove(), 800);
  }, feedbackVisibleTime);
}

/* ========= QUIZ FUNCTIONS ========= */
export async function startQuiz() {
  currentQuestion = 0;
  score = 0;
  totalTime = 0;
  correctAnswers = 0;

  // Pre-load questions before showing quiz screen
  await loadQuestions();

  showScreen(quizScreen);
  loadQuestion();
}

function loadQuestion() {
  colorChangeTimeouts.forEach((t) => clearTimeout(t));
  colorChangeTimeouts = [];
  if (timeoutIdForAutoAdvance) {
    clearTimeout(timeoutIdForAutoAdvance);
    timeoutIdForAutoAdvance = null;
  }

  const qList = questionsData[currentLanguage] || [];

  if (currentQuestion >= qList.length) {
    resultMessage.textContent =
      correctAnswers === 0
        ? messages[currentLanguage].noCorrect
        : messages[currentLanguage].score(correctAnswers, qList.length);
    showScreen(emailPopup, 60000);
    return;
  }

  questionContainer.style.opacity = 0;
  setTimeout(() => {
    const q = qList[currentQuestion];
    questionImg.src = q.img;
    questionText.textContent = q.question;

    optionsGrid.innerHTML = "";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => selectOption(i));
      optionsGrid.appendChild(btn);
    });

    timerFill.style.transition = "none";
    timerFill.style.width = "100%";
    void timerFill.offsetWidth;

    timerFill.style.transition = `width ${totalTimePerQuestion}s linear`;
    questionStartTs = performance.now();

    const t1 = totalTimePerQuestion * 1000 * (1 / 3);
    const t2 = totalTimePerQuestion * 1000 * (2 / 3);
    timerFill.style.backgroundColor =
      getComputedStyle(document.documentElement).getPropertyValue("--green") ||
      "#28a745";
    colorChangeTimeouts.push(
      setTimeout(
        () =>
          (timerFill.style.backgroundColor =
            getComputedStyle(document.documentElement).getPropertyValue(
              "--yellow",
            ) || "#ffc107"),
        t2,
      ),
    );
    colorChangeTimeouts.push(
      setTimeout(
        () =>
          (timerFill.style.backgroundColor =
            getComputedStyle(document.documentElement).getPropertyValue(
              "--red",
            ) || "#dc3545"),
        t1,
      ),
    );

    setTimeout(() => (timerFill.style.width = "0%"), 20);

    timeoutIdForAutoAdvance = setTimeout(
      () => selectOption(-1),
      totalTimePerQuestion * 1000,
    );

    questionContainer.style.opacity = 1;
  }, 450);
}

function selectOption(selected) {
  if (timeoutIdForAutoAdvance) {
    clearTimeout(timeoutIdForAutoAdvance);
    timeoutIdForAutoAdvance = null;
  }

  const computedWidth = getComputedStyle(timerFill).width;
  timerFill.style.transition = "none";
  timerFill.style.width = computedWidth;

  colorChangeTimeouts.forEach((t) => clearTimeout(t));
  colorChangeTimeouts = [];

  const now = performance.now();
  let elapsedMs = now - (questionStartTs || now);
  if (elapsedMs < 0) elapsedMs = 0;
  const elapsedSec = Math.min(elapsedMs / 1000, totalTimePerQuestion);
  totalTime += Math.round(elapsedSec * 10) / 10;

  const qList = questionsData[currentLanguage] || [];
  const q = qList[currentQuestion];

  const optionButtons = document.querySelectorAll(".option-btn");
  optionButtons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add("correct");
    if (i === selected && selected !== q.answer) btn.classList.add("wrong");
  });

  let pointsGained = 0;
  if (selected === q.answer) {
    const secondsRemaining = Math.max(0, totalTimePerQuestion - elapsedSec);
    const bonus = Math.floor(secondsRemaining);
    pointsGained = 10 + bonus;
    score += pointsGained;
    correctAnswers++;
  }

  const bubbleLines = [];
  if (pointsGained > 0) {
    bubbleLines.push(
      messages[currentLanguage].points.replace("{points}", pointsGained),
    );
    bubbleLines.push(
      messages[currentLanguage].timeSpent.replace(
        "{time}",
        Math.round(elapsedSec),
      ),
    );
  } else {
    bubbleLines.push(messages[currentLanguage].points.replace("{points}", 0));
    bubbleLines.push(
      elapsedSec >= totalTimePerQuestion - 0.05
        ? messages[currentLanguage].timeout
        : messages[currentLanguage].timeSpent.replace(
            "{time}",
            Math.round(elapsedSec),
          ),
    );
  }
  showFeedbackBubble(bubbleLines, 160);

  setTimeout(() => {
    currentQuestion++;
    timerFill.style.transition = "none";
    timerFill.style.width = "100%";
    loadQuestion();
  }, feedbackDelay);
}

/* ========= EMAIL & LEADERBOARD ========= */
export function submitEmail() {
  const name = playerNameInput.value.trim();
  const email = playerEmailInput.value.trim();
  if (!name || !email) return alert(messages[currentLanguage].fillNameEmail);

  const leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "[]");
  leaderboard.push({ name, email, score, totalTime });
  leaderboard.sort((a, b) => b.score - a.score || a.totalTime - b.totalTime);
  if (leaderboard.length > 20) leaderboard.length = 20;
  localStorage.setItem("leaderboard", JSON.stringify(leaderboard));

  showLeaderboard();
}

export function showLeaderboard() {
  showScreen(document.getElementById("leaderboard-screen"));
  const leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "[]");
  leaderboardList.innerHTML = "";
  leaderboard.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.name}</strong> - ${p.score.toFixed(
      0,
    )} pts - ${p.totalTime.toFixed(1)}s`;
    leaderboardList.appendChild(li);
  });
}

export function exportCSV() {
  const leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "[]");
  let csv = "Nome,Email,Score,Tempo\n";
  leaderboard.forEach((p) => {
    csv += `${p.name},${p.email},${p.score.toFixed(0)},${p.totalTime.toFixed(
      1,
    )}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leaderboard.csv";
  a.click();
  URL.revokeObjectURL(url);
}
