/* ========= STOCK MODULE ========= */

import { getActiveEvent, getEventCars } from "./events.js";
import { showScreen } from "./utils.js";

/* ========= STATE ========= */
let stockCars = []; // Will be populated from active event
let searchQuery = ""; // Track current search query

/* ========= DOM REFS ========= */
const stockScreen = document.getElementById("stock-screen");
const stockGrid = document.getElementById("stock-grid");
const searchInput = document.getElementById("search-input");
const modal = document.getElementById("modal");
const modalImg = document.getElementById("modal-img");
const modalCaption = document.getElementById("modal-caption");

// Setup search listener
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase();
  renderFilteredStockGrid();
});

/* ========= LOAD EVENT CARS ========= */
/**
 * Fetch products from active event in Supabase
 */
async function loadActiveEventCars() {
  try {
    const activeEvent = await getActiveEvent();
    if (!activeEvent) {
      console.warn("No active event set");
      stockCars = [];
      return;
    }

    const cars = await getEventCars(activeEvent.id);
    stockCars = cars.map((car) => ({
      id: car.id,
      name: car.name,
      img: car.image_url,
      price: car.price,
      is_sold: car.is_sold,
      color: car.color,
      size: car.size,
      quantity: car.quantity ?? 1,
      tags: car.tags || ""
    }));

    console.log(`✓ Loaded ${stockCars.length} cars from event`);
  } catch (err) {
    console.warn("Could not fetch active event cars:", err);
    stockCars = [];
  }
}

/* ========= STOCK UI ========= */
export async function showStock() {
  // Show the stock screen immediately with loading indicator
  showScreen(stockScreen);

  // Display loading message
  stockGrid.innerHTML = '<div class="loading">A carregar o stock...</div>';

  // Load cars from active event
  await loadActiveEventCars();

  // Render the grid (event cars or empty if no event)
  renderStockGrid();
}

function getFilteredCars() {
  if (!searchQuery) return stockCars;
  const query = searchQuery.toLowerCase();
  return stockCars.filter((car) => {
    const nameMatch = car.name.toLowerCase().includes(query);
    const tagMatch = car.tags ? car.tags.toLowerCase().includes(query) : false;
    return nameMatch || tagMatch;
  });
}

function renderStockGrid() {
  searchQuery = ""; // Reset search
  searchInput.value = ""; // Clear input
  renderFilteredStockGrid();
}

function renderFilteredStockGrid() {
  const filtered = getFilteredCars();
  stockGrid.innerHTML = "";

  if (stockCars.length === 0) {
    stockGrid.innerHTML =
      '<div class="no-results">Nenhum evento ativo ou nenhum carro disponível</div>';
    return;
  }

  if (filtered.length === 0) {
    stockGrid.innerHTML =
      '<div class="no-results">Nenhum produto encontrado</div>';
    return;
  }

  filtered.forEach((car) => {
    const card = document.createElement("div");
    card.className = "stock-card";
    if (car.is_sold) card.classList.add("sold");
    card.innerHTML = `
      <div class="stock-card-row img-row">
        <img src="${car.img}" alt="${car.name}">
      </div>
      <div class="stock-card-row name-row">
        <p class="stock-item-name">${car.name}</p>
      </div>
      <div class="stock-card-row meta-row">
        ${car.color || car.size ? `<span class="stock-item-variant">${car.color || ""} ${car.size ? `/ ${car.size}` : ""}</span>` : "<span></span>"}
        <span class="stock-item-qty">${car.is_sold ? "INDISPONÍVEL" : `${car.quantity} disponíveis`}</span>
      </div>
    `;
    if (!car.is_sold) {
      card.addEventListener("click", () => openModal(car));
      card.style.cursor = "pointer";
    }
    stockGrid.appendChild(card);
  });
}

function openModal(car) {
  modal.style.display = "block";
  modalImg.src = car.img;
  modalCaption.innerHTML = `
    <strong>${car.name}</strong><br>
    ${car.color || car.size ? `<span>${car.color || ""} ${car.size ? `/ ${car.size}` : ""}</span>` : ""}
    <p class="qty-label">${car.is_sold ? "OUT OF STOCK" : `${car.quantity} Units Available`}</p>
  `;
}

/* ========= MODAL HANDLERS ========= */
const closeModal = document.getElementById("close-modal");
const backHome = document.getElementById("back-home");

closeModal.addEventListener("click", () => (modal.style.display = "none"));

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

backHome.addEventListener("click", () => {
  showScreen(document.getElementById("home-screen"));
});
