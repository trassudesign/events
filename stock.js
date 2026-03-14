/* ========= STOCK MODULE ========= */

import { getActiveEvent, getEventCars } from "./events.js";
import { showScreen } from "./utils.js";
import { currentLanguage } from "./quiz.js";
import { textContent } from "./main.js";

/* ========= STATE ========= */
let stockCars = []; // Will be populated from active event
let searchQuery = ""; // Track current search query
let activeStockCategory = "all";

/* ========= DOM REFS ========= */
const stockScreen = document.getElementById("stock-screen");
const stockGrid = document.getElementById("stock-grid");
const searchInput = document.getElementById("search-input");
const stockCategoryFilters = document.getElementById("stock-category-filters");
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
    })).sort((a, b) => a.name.localeCompare(b.name));

    console.log(`✓ Loaded and sorted ${stockCars.length} cars from event`);
  } catch (err) {
    console.warn("Could not fetch active event cars:", err);
    stockCars = [];
  }
}

/* ========= STOCK UI ========= */
export async function showStock() {
  const texts = textContent[currentLanguage];

  // Show the stock screen immediately with loading indicator
  showScreen(stockScreen);

  // Update static texts
  if (searchInput) searchInput.placeholder = texts.searchPlaceholder;
  if (backHome) backHome.textContent = texts.backHome;
  
  const searchBtnStock = document.getElementById("search-btn-stock");
  if (searchBtnStock) searchBtnStock.textContent = `🔍 ${texts.searchText}`;

  // Display loading message
  stockGrid.innerHTML = `<div class="loading">${texts.loadingStock}</div>`;

  // Load cars from active event
  await loadActiveEventCars();

  // Render the grid (event cars or empty if no event)
  renderStockGrid();
}

function getFilteredCars() {
  const query = searchQuery.toLowerCase();
  
  return stockCars.filter((car) => {
    // 1. Search Query Match
    const nameMatch = car.name.toLowerCase().includes(query);
    const tagMatch = car.tags ? car.tags.toLowerCase().includes(query) : false;
    const matchesSearch = !query || nameMatch || tagMatch;

    // 2. Category Match
    let matchesCategory = true;
    if (activeStockCategory !== "all") {
      const tagsStr = (car.tags || "").toLowerCase();
      
      if (activeStockCategory === "cars") {
        matchesCategory = tagsStr.includes("car") || tagsStr.includes("carro");
      } else if (activeStockCategory === "bikes") {
        matchesCategory = tagsStr.includes("bike") || tagsStr.includes("mota") || tagsStr.includes("moto");
      } else if (activeStockCategory === "tracks") {
        matchesCategory = tagsStr.includes("track") || tagsStr.includes("circuito");
      } else if (activeStockCategory === "helmets") {
        matchesCategory = tagsStr.includes("helmet") || tagsStr.includes("capacete");
      }
    }

    return matchesSearch && matchesCategory;
  });
}

function renderStockCategoryPills() {
  if (!stockCategoryFilters) return;

  // Find which of our standard categories are present in current stock
  const categoriesPresent = new Set();
  stockCars.forEach(car => {
    const tags = (car.tags || "").toLowerCase();
    if (tags.includes("car") || tags.includes("carro")) categoriesPresent.add("cars");
    if (tags.includes("bike") || tags.includes("mota") || tags.includes("moto")) categoriesPresent.add("bikes");
    if (tags.includes("track") || tags.includes("circuito")) categoriesPresent.add("tracks");
    if (tags.includes("helmet") || tags.includes("capacete")) categoriesPresent.add("helmets");
  });

  // User rule: Only show if 2 or more categories are present
  if (categoriesPresent.size < 2) {
    stockCategoryFilters.innerHTML = "";
    stockCategoryFilters.style.display = "none";
    activeStockCategory = "all"; // Reset just in case
    return;
  }

  stockCategoryFilters.style.display = "flex";
  
  const texts = textContent[currentLanguage];
  const labels = texts.categories;

  let html = `<button class="filter-pill ${activeStockCategory === 'all' ? 'active' : ''}" data-category="all">${labels.all}</button>`;
  
  ["cars", "bikes", "tracks", "helmets"].forEach(cat => {
    if (categoriesPresent.has(cat)) {
      html += `<button class="filter-pill ${activeStockCategory === cat ? 'active' : ''}" data-category="${cat}">${labels[cat]}</button>`;
    }
  });

  stockCategoryFilters.innerHTML = html;
}

// Category pills delegation for stock page
if (stockCategoryFilters) {
  stockCategoryFilters.addEventListener("click", (e) => {
    const pill = e.target.closest(".filter-pill");
    if (!pill) return;

    activeStockCategory = pill.dataset.category;
    
    // Update active class
    const pills = stockCategoryFilters.querySelectorAll(".filter-pill");
    pills.forEach(p => p.classList.toggle("active", p.dataset.category === activeStockCategory));
    
    renderFilteredStockGrid();
  });
}

function renderStockGrid() {
  searchQuery = ""; // Reset search
  searchInput.value = ""; // Clear input
  activeStockCategory = "all"; // Reset category
  renderStockCategoryPills();
  renderFilteredStockGrid();
}

function renderFilteredStockGrid() {
  const filtered = getFilteredCars();
  stockGrid.innerHTML = "";

  if (stockCars.length === 0) {
    const texts = textContent[currentLanguage];
    stockGrid.innerHTML =
      `<div class="no-results">${texts.noResults}</div>`;
    return;
  }

  if (filtered.length === 0) {
    stockGrid.innerHTML =
      `<div class="no-results">${texts.noResults}</div>`;
    return;
  }

  filtered.forEach((car) => {
    const card = document.createElement("div");
    card.className = "stock-card";
    if (car.is_sold) card.classList.add("sold");
    const isSoldLabel = currentLanguage === "pt" ? "ESGOTADO" : "SOLD OUT";
    const availableLabel = currentLanguage === "pt" ? "unidades" : "units";

    card.innerHTML = `
      <div class="stock-card-row img-row">
        <img src="${car.img}" alt="${car.name}">
      </div>
      <div class="stock-card-row name-row">
        <p class="stock-item-name">${car.name}</p>
      </div>
      <div class="stock-card-row meta-row">
        ${car.color || car.size ? `<span class="stock-item-variant">${car.color || ""} ${car.size ? `/ ${car.size}` : ""}</span>` : "<span></span>"}
        <span class="stock-item-qty">${car.is_sold ? isSoldLabel : `${car.quantity} ${availableLabel}`}</span>
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
    const outOfStockLabel = currentLanguage === "pt" ? "ESGOTADO" : "OUT OF STOCK";
    const availableLabel = currentLanguage === "pt" ? "unidades disponíveis" : "Units Available";

    modalCaption.innerHTML = `
    <strong>${car.name}</strong><br>
    ${car.color || car.size ? `<span>${car.color || ""} ${car.size ? `/ ${car.size}` : ""}</span>` : ""}
    <p class="qty-label">${car.is_sold ? outOfStockLabel : `${car.quantity} ${availableLabel}`}</p>
  `;
}

/* ========= MODAL HANDLERS ========= */
const closeModal = document.getElementById("close-modal");
const backHome = document.getElementById("back-home");

closeModal.addEventListener("click", () => (modal.style.display = "none"));

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

if (backHome) {
  backHome.addEventListener("click", () => {
    location.hash = "";
  });
}

/* ========= FULL STORE STOCK (SHOPIFY CATALOG) ========= */
const fullStoreScreen = document.getElementById("full-store-screen");
const fullStoreGrid = document.getElementById("full-store-grid");
const backHomeStore = document.getElementById("back-home-store");
const qrModal = document.getElementById("qr-modal");
const qrcodeContainer = document.getElementById("qrcode");
const qrProductName = document.getElementById("qr-product-name");
const closeQr = document.getElementById("close-qr");
const qrInstruction = document.getElementById("qr-instruction");

const fullStoreSearchInput = document.getElementById("full-store-search");

let qrcode = null;
let shopifyProducts = []; // Store fetched products for filtering
let activeCategory = "all";

export async function showFullStore() {
  const texts = textContent[currentLanguage];
  showScreen(fullStoreScreen);
  fullStoreGrid.innerHTML = `<div class="loading">${texts.loadingStore}</div>`;
  
  if (fullStoreSearchInput) {
    fullStoreSearchInput.placeholder = texts.fullStoreSearchPlaceholder;
    fullStoreSearchInput.value = "";
  }

  const bhs = document.getElementById("back-home-store");
  if (bhs) bhs.textContent = texts.backHome;

  const searchBtnStore = document.getElementById("search-btn-store");
  if (searchBtnStore) searchBtnStore.textContent = `🔍 ${texts.searchText}`;

  const info = document.getElementById("full-store-info");
  if (info) info.querySelector("p").textContent = texts.fullStoreInfo;
  
  // Reset active category pill
  activeCategory = "all";
  // Pills will be rendered after products are fetched

  // Ensure active event cars are loaded for the "in stock" badge comparison
  if (stockCars.length === 0) {
    await loadActiveEventCars();
  }

  const shopifyDomain = "d687ec-85.myshopify.com";
  const endpoint = `https://${shopifyDomain}/products.json?limit=250`;

    try {
    const res = await fetch(endpoint);
    const data = await res.json();
    shopifyProducts = (data.products || []).sort((a, b) => {
      const aIsRequest = a.title.toLowerCase().startsWith("request a");
      const bIsRequest = b.title.toLowerCase().startsWith("request a");
      
      if (aIsRequest && !bIsRequest) return -1;
      if (!aIsRequest && bIsRequest) return 1;
      return a.title.localeCompare(b.title);
    });

    renderFullStoreCategoryPills();
    renderFullStoreGrid(shopifyProducts);
  } catch (err) {
    const texts = textContent[currentLanguage];
    fullStoreGrid.innerHTML = `<div class="no-results">${texts.errorLoading}: ${err.message}</div>`;
  }
}

fullStoreSearchInput.addEventListener("input", () => {
  applyFullStoreFilters();
});

// Click handlers for search buttons
document.getElementById("search-btn-stock")?.addEventListener("click", renderStockGrid);
document.getElementById("search-btn-store")?.addEventListener("click", applyFullStoreFilters);

// Category pills delegation
document.getElementById("category-filters").addEventListener("click", (e) => {
  const pill = e.target.closest(".filter-pill");
  if (!pill) return;

  activeCategory = pill.dataset.category;
  
  // Update active class on pills
  const pills = document.getElementById("category-filters").querySelectorAll(".filter-pill");
  pills.forEach(p => p.classList.toggle("active", p.dataset.category === activeCategory));
  
  applyFullStoreFilters();
});

function renderFullStoreCategoryPills() {
  const container = document.getElementById("category-filters");
  if (!container) return;
  container.style.display = "flex";
  
  const texts = textContent[currentLanguage];
  const labels = texts.categories;

  let html = `<button class="filter-pill ${activeCategory === 'all' ? 'active' : ''}" data-category="all">${labels.all}</button>`;
  
  ["cars", "bikes", "tracks", "helmets"].forEach(cat => {
    html += `<button class="filter-pill ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${labels[cat]}</button>`;
  });

  container.innerHTML = html;
}

function applyFullStoreFilters() {
  const query = fullStoreSearchInput.value.toLowerCase();
  
  const filtered = shopifyProducts.filter(p => {
    // Robust data handling
    const tagList = Array.isArray(p.tags) ? p.tags : (p.tags || "").split(",").map(t => t.trim());
    const tagsStr = tagList.join(" ").toLowerCase();
    const typeStr = (p.product_type || "").toLowerCase();
    const titleStr = (p.title || "").toLowerCase();

    // 1. Text Search Filter
    const matchesSearch = !query || 
      titleStr.includes(query) || 
      tagsStr.includes(query) ||
      typeStr.includes(query);

    // 2. Category Filter
    let matchesCategory = true;
    if (activeCategory !== "all") {
      if (activeCategory === "cars") {
        matchesCategory = tagsStr.includes("car") || tagsStr.includes("carro") || typeStr.includes("car");
      } else if (activeCategory === "bikes") {
        matchesCategory = tagsStr.includes("bike") || tagsStr.includes("mota") || tagsStr.includes("moto") || typeStr.includes("bike") || typeStr.includes("mota");
      } else if (activeCategory === "tracks") {
        matchesCategory = tagsStr.includes("track") || tagsStr.includes("circuito") || typeStr.includes("track") || typeStr.includes("circuit");
      } else if (activeCategory === "helmets") {
        matchesCategory = tagsStr.includes("helmet") || tagsStr.includes("capacete") || typeStr.includes("helmet");
      }
    }

    return matchesSearch && matchesCategory;
  });

  renderFullStoreGrid(filtered);
}

function renderFullStoreGrid(products) {
  const texts = textContent[currentLanguage];
  fullStoreGrid.innerHTML = "";

  if (products.length === 0) {
    fullStoreGrid.innerHTML = `<div class="no-results">${texts.noResults}</div>`;
    return;
  }

  // Show one card per product instead of all variants
  products.forEach((product) => {
    // Get representative variant (first one)
    const variant = product.variants[0];
    const card = document.createElement("div");
    card.className = "stock-card";

    // Use product featured image or first image
    const img = product.images[0]?.src || "";

    // Check if this exists in the active event stock
    const inEventStock = stockCars.some(c => 
      c.name.toLowerCase() === product.title.toLowerCase() || 
      c.name.toLowerCase().includes(product.title.toLowerCase())
    );

    const productUrl = `https://d687ec-85.myshopify.com/products/${product.handle}`;

    card.innerHTML = `
      <div class="stock-card-row img-row">
        <img src="${img}" alt="${product.title}">
        ${inEventStock ? `<span class="event-stock-badge">${texts.inEventStock}</span>` : ""}
      </div>
      <div class="stock-card-row name-row">
        <p class="stock-item-name">${product.title}</p>
      </div>
      <div class="stock-card-row meta-row">
        <span class="stock-item-variant">${product.product_type || "Model"}</span>
        <span class="stock-item-price">${texts.fromPrice} €${variant.price}</span>
      </div>
    `;

    card.addEventListener("click", () => openQrModal(product.title, productUrl));
    card.style.cursor = "pointer";
    fullStoreGrid.appendChild(card);
  });
}

function openQrModal(name, url) {
  const texts = textContent[currentLanguage];
  qrProductName.textContent = name;
  if (qrInstruction) qrInstruction.textContent = texts.qrInstruction;
  qrcodeContainer.innerHTML = "";
  qrModal.style.display = "block";

  qrcode = new QRCode(qrcodeContainer, {
    text: url,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

closeQr.addEventListener("click", () => (qrModal.style.display = "none"));
qrModal.addEventListener("click", (e) => {
  if (e.target === qrModal) qrModal.style.display = "none";
});
// Full store back button setup
const bhs = document.getElementById("back-home-store");
if (bhs) {
  bhs.addEventListener("click", () => {
    location.hash = "";
  });
}
