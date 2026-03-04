/* ========= UTILS MODULE - Shared utilities ========= */

/* ========= SCREEN NAVIGATION ========= */

let emailPopupIdleTimeout = null;

/**
 * Show a screen and hide all others.
 * If the target is the email popup, starts an idle timer that auto-returns home.
 */
export function showScreen(screen, emailPopupTimeout = 60000) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  screen.classList.add("active");

  const emailPopup = document.getElementById("email-popup");
  if (screen === emailPopup) {
    startEmailPopupIdleTimer(emailPopupTimeout);
  } else {
    clearEmailPopupIdleTimer();
  }
}

/* ========= EMAIL POPUP IDLE TIMER ========= */

function startEmailPopupIdleTimer(emailPopupTimeout) {
  clearEmailPopupIdleTimer();
  const emailPopup = document.getElementById("email-popup");

  emailPopupIdleTimeout = setTimeout(() => {
    showScreen(document.getElementById("home-screen"));
  }, emailPopupTimeout);

  emailPopup.addEventListener("mousemove", clearEmailPopupIdleTimer);
  emailPopup.addEventListener("keydown", clearEmailPopupIdleTimer);
  emailPopup.addEventListener("click", clearEmailPopupIdleTimer);
}

function clearEmailPopupIdleTimer() {
  if (emailPopupIdleTimeout) clearTimeout(emailPopupIdleTimeout);
  emailPopupIdleTimeout = null;
}
