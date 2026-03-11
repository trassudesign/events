/* ========= ADMIN MODULE ========= */

import {
  getAllEvents,
  getActiveEvent,
  createEvent,
  setActiveEvent,
  duplicateEvent,
  deleteEvent,
  updateEvent,
  getEventCars,
  addCarToEvent,
  markCarAsSold,
  deleteCar,
  getEventStats,
  exportEventToCSV,
  recordTransaction,
} from "./events.js";
import { uploadImage, supabaseFetch, supabaseSignIn, supabaseSignOut, getSupabaseSession } from "./config.js";
import { showScreen } from "./utils.js";

/* ========= ADMIN AUTH ========= */
let isAdminAuthenticated = false;
let currentEditEventId = null;

export function isAdmin() {
  return isAdminAuthenticated;
}

export async function authenticateAdmin(email, password) {
  try {
    const session = await supabaseSignIn(email, password);
    if (session) {
      isAdminAuthenticated = true;
      return true;
    }
  } catch (err) {
    console.error("Auth failed:", err.message);
    throw err;
  }
  return false;
}

export function logoutAdmin() {
  isAdminAuthenticated = false;
  supabaseSignOut();
}

// Check if already authenticated from previous session
export function checkAdminAuth() {
  const session = getSupabaseSession();
  if (session) {
    isAdminAuthenticated = true;
  }
}

/* ========= EVENT DELEGATION SETUP ========= */

export function setupAdminDelegation() {
  // Admin main screen — event list actions + create/logout buttons
  const adminScreen = document.getElementById("admin-screen");
  adminScreen.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { action, id } = btn.dataset;

    switch (action) {
      case "create-event":
        showCreateEventForm();
        break;
      case "go-home":
        location.hash = "";
        break;
      case "admin-logout":
        logoutAdmin();
        location.hash = "";
        break;
      case "edit":
        await editEvent(id);
        break;
      case "set-active":
        await setActiveEventUI(id);
        break;
      case "duplicate":
        showDuplicateEventForm(id);
        break;
      case "delete":
        await deleteEventUI(id);
        break;
      case "view-stats":
        await viewStats(id);
        break;
      case "toggle-quiz":
        const showQuiz = btn.checked;
        try {
          await updateEvent(id, { show_quiz: showQuiz });
          notifyAdmin(`Quiz ${showQuiz ? "ativado" : "desativado"} para este evento`, "success");
        } catch (err) {
          notifyAdmin("Erro ao atualizar quiz: " + err.message);
          btn.checked = !showQuiz; // Revert
        }
        break;
      case "toggle-online-store":
        const showStore = btn.checked;
        try {
          await updateEvent(id, { show_online_store: showStore });
          notifyAdmin(`Loja Online ${showStore ? "ativada" : "desativada"} para este evento`, "success");
        } catch (err) {
          notifyAdmin("Erro ao atualizar loja: " + err.message);
          btn.checked = !showStore; // Revert
        }
        break;
    }
  });

  // Admin edit screen — car actions + add/back buttons
  const adminEditScreen = document.getElementById("admin-edit-screen");
  adminEditScreen.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { action, id, sold } = btn.dataset;

    switch (action) {
      case "add-car":
        showAddCarOptions(id);
        break;
      case "change-logo":
        showLogoUploadForm(id);
        break;
      case "submit-logo":
        await handleLogoUpload(id);
        break;
      case "add-from-shopify":
        await showShopifyPicker(id);
        break;
      case "add-custom":
        showCustomCarForm(id);
        break;
      case "submit-custom-car":
        await handleCustomCarSubmit(id);
        break;
      case "back-to-edit":
        await editEvent(currentEditEventId);
        break;
      case "back-to-admin":
        await showAdminPanel();
        break;
      case "toggle-sold":
        await toggleSoldStatus(id, sold === "true");
        break;
      case "toggle-variant":
        btn.classList.toggle("selected");
        // If variant has a specific image, update the card image locally
        const cardImg = btn.closest(".shopify-item").querySelector(".shopify-item-main img");
        if (cardImg && btn.dataset.variantImage && btn.classList.contains("selected")) {
          cardImg.src = btn.dataset.variantImage;
          cardImg._originalSrc = cardImg._originalSrc || cardImg.src;
        } else if (cardImg && cardImg._originalSrc && !btn.closest(".shopify-variants").querySelector(".selected")) {
          // Revert to original if no variants selected in this card
          cardImg.src = cardImg._originalSrc;
        }
        break;
      case "sell-one":
        await handleSellOne(id);
        break;
      case "add-one":
        await handleAddOne(id);
        break;
      case "remove-car":
        await removeCarUI(id);
        break;
      case "add-selected-shopify":
        await handleShopifySelection(id);
        break;
    }
  });

  // Admin stats screen — export/back buttons
  const adminStatsScreen = document.getElementById("admin-stats-screen");
  adminStatsScreen.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { action, id, name } = btn.dataset;

    switch (action) {
      case "export-stats":
        await exportEventStats(id, name);
        break;
      case "back-to-admin":
        await showAdminPanel();
        break;
    }
  });
}

/**
 * Decrement car quantity by 1
 */
async function handleSellOne(carId) {
  try {
    const cars = await getEventCars(currentEditEventId);
    const car = cars.find(c => c.id === carId);
    if (!car) return;

    const newQty = (car.quantity || 1) - 1;
    // Assuming supabaseFetch is available globally or imported
    await supabaseFetch(`/cars?id=eq.${carId}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity: Math.max(0, newQty),
        is_sold: newQty <= 0
      }),
    });

    // Record the transaction
    await recordTransaction(car.id, car.event_id, car.name, car.price);

    await editEvent(currentEditEventId);
  } catch (err) {
    notifyAdmin("Error updating stock: " + err.message);
  }
}

/**
 * Increment car quantity by 1
 */
async function handleAddOne(carId) {
  try {
    const cars = await getEventCars(currentEditEventId);
    const car = cars.find(c => c.id === carId);
    if (!car) return;

    // Assuming supabaseFetch is available globally or imported
    await supabaseFetch(`/cars?id=eq.${carId}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity: (car.quantity || 1) + 1,
        is_sold: false
      }),
    });
    await editEvent(currentEditEventId);
  } catch (err) {
    notifyAdmin("Error updating stock: " + err.message);
  }
}

/**
 * Show a notification message in the admin panel
 */
function notifyAdmin(message, type = "error") {
  // Find which screen is active to show notification there
  const activeScreen = document.querySelector(".screen.active");
  const notificationEl = activeScreen
    ? activeScreen.querySelector(".admin-notification")
    : null;

  if (!notificationEl) return;

  notificationEl.textContent = message;
  notificationEl.className = `admin-notification active ${type}`;

  // Hide after 5 seconds
  setTimeout(() => {
    notificationEl.classList.remove("active");
  }, 5000);
}

/* ========= ADMIN UI FUNCTIONS ========= */

/**
 * Show admin panel and load events
 */
export async function showAdminPanel() {
  const adminScreen = document.getElementById("admin-screen");

  if (!isAdminAuthenticated) {
    showAdminLogin();
    return;
  }

  // Restore the default admin content structure
  const adminContent = document.getElementById("admin-content");
  adminContent.innerHTML = `
    <div class="admin-top-actions">
      <h2>Admin Panel</h2>
      <button class="btn-small" data-action="go-home">Return to Home</button>
    </div>
    <div class="admin-notification"></div>
    <button data-action="create-event">+ Create Event</button>
    <div id="events-list"></div>
    <button data-action="admin-logout">Logout</button>
  `;

  showScreen(adminScreen);
  await loadAdminEvents();
}

/**
 * Show login modal (HTML-based)
 */
function showAdminLogin() {
  const loginModal = document.getElementById("admin-login-modal");
  const emailInput = document.getElementById("admin-email");
  const passInput = document.getElementById("admin-password");
  const loginError = document.getElementById("admin-login-error");
  const submitBtn = document.getElementById("admin-login-submit");
  const cancelBtn = document.getElementById("admin-login-cancel");

  // Reset state
  if (emailInput) emailInput.value = "";
  if (passInput) passInput.value = "";
  if (loginError) loginError.textContent = "";

  showScreen(loginModal);
  if (emailInput) emailInput.focus();

  async function handleSubmit() {
    const email = emailInput.value.trim();
    const pass = passInput.value.trim();

    if (!email || !pass) {
      loginError.textContent = "Preencha todos os campos";
      return;
    }

    submitBtn.innerText = "A entrar...";
    submitBtn.disabled = true;

    try {
      if (await authenticateAdmin(email, pass)) {
        cleanup();
        showAdminPanel();
      }
    } catch (err) {
      loginError.textContent = "Login falhou: verifique email/senha";
      console.error(err);
    } finally {
      submitBtn.innerText = "Entrar";
      submitBtn.disabled = false;
    }
  }

  function handleCancel() {
    cleanup();
    location.href = "/";
  }

  function handleKeydown(e) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") handleCancel();
  }

  function cleanup() {
    submitBtn.removeEventListener("click", handleSubmit);
    cancelBtn.removeEventListener("click", handleCancel);
    passInput.removeEventListener("keydown", handleKeydown);
  }

  submitBtn.addEventListener("click", handleSubmit);
  cancelBtn.addEventListener("click", handleCancel);
  passInput.addEventListener("keydown", handleKeydown);
}

/**
 * Load and display all events in admin panel
 */
export async function loadAdminEvents() {
  const eventsList = document.getElementById("events-list");
  const events = await getAllEvents();

  eventsList.innerHTML = "";

  if (events.length === 0) {
    eventsList.innerHTML = "<p>No events yet. Create one to get started!</p>";
    return;
  }

  events.forEach((event) => {
    const eventCard = document.createElement("div");
    eventCard.className = "event-card";
    if (event.is_active) eventCard.classList.add("active");

    const eventDate = event.date
      ? new Date(event.date).toLocaleDateString("pt-PT")
      : "No date";

    eventCard.innerHTML = `
      <div class="event-header">
        <h3>${event.name}</h3>
        <span class="event-date">${eventDate}</span>
        ${event.is_active ? '<span class="badge active-badge">ACTIVE</span>' : ""}
      </div>
      <div class="event-actions">
        <div class="toggles-wrapper">
          <div class="quiz-toggle-inline">
            <label class="switch small-switch">
              <input type="checkbox" data-action="toggle-quiz" data-id="${event.id}" ${event.show_quiz !== false ? "checked" : ""}>
              <span class="slider round"></span>
            </label>
            <span class="toggle-label">Quiz</span>
          </div>
          <div class="quiz-toggle-inline">
            <label class="switch small-switch">
              <input type="checkbox" data-action="toggle-online-store" data-id="${event.id}" ${event.show_online_store !== false ? "checked" : ""}>
              <span class="slider round"></span>
            </label>
            <span class="toggle-label">Full Store Stock button</span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="btn-small" data-action="edit" data-id="${event.id}">Edit</button>
          <button class="btn-small" data-action="set-active" data-id="${event.id}">Set Active</button>
          <button class="btn-small" data-action="duplicate" data-id="${event.id}">Duplicate</button>
          <button class="btn-small btn-danger" data-action="delete" data-id="${event.id}">Delete</button>
          <button class="btn-small btn-stats" data-action="view-stats" data-id="${event.id}">Stats</button>
        </div>
      </div>
    `;

    eventsList.appendChild(eventCard);
  });
}

/* ========= CREATE / DUPLICATE EVENT (HTML forms) ========= */

/**
 * Show create event form (replaces prompt)
 */
function showCreateEventForm() {
  const adminContent = document.getElementById("admin-content");
  adminContent.innerHTML = `
    <h2>Create New Event</h2>
    <div class="admin-form">
      <label>Event Name</label>
      <input type="text" id="new-event-name" placeholder="e.g. Portimão 2026" />
      <label>Event Date (optional)</label>
      <input type="date" id="new-event-date" />
      <div class="form-actions">
        <button id="submit-create-event" class="btn-small">Create</button>
        <button id="cancel-create-event" class="btn-small btn-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById("new-event-name").focus();

  document.getElementById("submit-create-event").addEventListener("click", async () => {
    const name = document.getElementById("new-event-name").value.trim();
    if (!name) return notifyAdmin("Please enter an event name");
    const date = document.getElementById("new-event-date").value || null;
    try {
      await createEvent(name, date);
      notifyAdmin("Event created successfully!", "success");
      await showAdminPanel();
    } catch (err) {
      notifyAdmin("Error creating event: " + err.message);
    }
  });

  document.getElementById("cancel-create-event").addEventListener("click", () => {
    showAdminPanel();
  });
}

/**
 * Show duplicate event form (replaces prompt)
 */
function showDuplicateEventForm(eventId) {
  const adminContent = document.getElementById("admin-content");
  adminContent.innerHTML = `
    <h2>Duplicate Event</h2>
    <div class="admin-form">
      <label>New Event Name</label>
      <input type="text" id="duplicate-event-name" placeholder="e.g. Lisboa 2026" />
      <div class="form-actions">
        <button id="submit-duplicate" class="btn-small">Duplicate</button>
        <button id="cancel-duplicate" class="btn-small btn-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById("duplicate-event-name").focus();

  document.getElementById("submit-duplicate").addEventListener("click", async () => {
    const newName = document.getElementById("duplicate-event-name").value.trim();
    if (!newName) return notifyAdmin("Please enter a name");
    try {
      await duplicateEvent(eventId, newName);
      notifyAdmin("Event duplicated!", "success");
      await showAdminPanel();
    } catch (err) {
      notifyAdmin("Error: " + err.message);
    }
  });

  document.getElementById("cancel-duplicate").addEventListener("click", () => {
    showAdminPanel();
  });
}

/**
 * Set active event
 */
async function setActiveEventUI(eventId) {
  try {
    await setActiveEvent(eventId);
    notifyAdmin("Active event changed!", "success");
    await loadAdminEvents();
  } catch (err) {
    notifyAdmin("Error: " + err.message);
  }
}

/**
 * Show a custom confirmation modal (replaces window.confirm)
 */
async function showAdminConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("admin-confirm-modal");
    const titleEl = document.getElementById("confirm-title");
    const messageEl = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    titleEl.textContent = title;
    messageEl.textContent = message;

    showScreen(modal);

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    const onKeydown = (e) => {
      if (e.key === "Enter") onYes();
      if (e.key === "Escape") onNo();
    };

    function cleanup() {
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      window.removeEventListener("keydown", onKeydown);
    }

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
    window.addEventListener("keydown", onKeydown);
  });
}

/**
 * Delete event UI
 */
async function deleteEventUI(eventId) {
  const confirmed = await showAdminConfirm(
    "Delete Event",
    "Are you sure you want to delete this event and all its cars? This action cannot be undone."
  );

  if (!confirmed) {
    showAdminPanel();
    return;
  }

  try {
    await deleteEvent(eventId);
    notifyAdmin("Event deleted", "success");
    await showAdminPanel();
  } catch (err) {
    notifyAdmin("Error: " + err.message);
    await showAdminPanel();
  }
}

/* ========= EDIT EVENT (car management) ========= */

/**
 * Edit event (manage cars)
 */
async function editEvent(eventId) {
  currentEditEventId = eventId;
  const adminEditScreen = document.getElementById("admin-edit-screen");

  showScreen(adminEditScreen);

  const editContent = document.getElementById("admin-edit-content");
  const event = (await getAllEvents()).find((e) => e.id === eventId);
  const cars = await getEventCars(eventId);

  editContent.innerHTML = `
    <div class="edit-header">
      <h2>Edit: ${event.name}</h2>
      <div class="event-logo-preview">
        ${event.logo_url ? `<img src="${event.logo_url}" alt="Event Logo" id="current-event-logo">` : '<div class="no-logo">No Logo</div>'}
        <button class="btn-small" data-action="change-logo" data-id="${eventId}">${event.logo_url ? "Change Logo" : "Add Logo"}</button>
      </div>
    </div>
    <div class="admin-notification"></div>
    
    <div class="admin-search-container">
      <input type="text" id="admin-car-search" placeholder="Search cars by name..." class="admin-search-input">
    </div>

    <div id="cars-list"></div>
    <div class="admin-footer-actions">
      <button data-action="add-car" data-id="${eventId}">+ Add Car</button>
      <button data-action="back-to-admin">Back</button>
    </div>
  `;

  const carsList = document.getElementById("cars-list");
  const searchInput = document.getElementById("admin-car-search");

  // Initial render
  renderEventCars(cars, carsList);

  // Search event listener
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    renderEventCars(cars, carsList, query);
  });
}

/**
 * Render cars for an event with optional filtering
 */
function renderEventCars(cars, container, query = "") {
  container.innerHTML = "";
  
  const filtered = query 
    ? cars.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(query);
        const tagMatch = c.tags ? c.tags.toLowerCase().includes(query) : false;
        return nameMatch || tagMatch;
      })
    : cars;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="no-results">${query ? "No cars match your search" : "No cars in this event"}</div>`;
    return;
  }

  filtered.forEach((car) => {
    const carCard = document.createElement("div");
    carCard.className = "car-card";
    if (car.is_sold) carCard.classList.add("sold");

    const qty = car.quantity || 1;
    const isOutOfStock = car.is_sold || qty <= 0;

    carCard.innerHTML = `
      <img src="${car.image_url}" alt="${car.name}" class="car-card-img">
      <div style="flex: 1;">
        <strong>${car.name}</strong><br>
        <div class="car-variant-info">
          ${car.color || car.size ? `<span>${car.color || ""} ${car.size ? `/ ${car.size}` : ""}</span> | ` : ""}
          €${car.price} | Qty: <strong>${qty}</strong>
        </div>
        ${isOutOfStock ? '<span class="badge">SOLD OUT</span>' : ""}
      </div>
      <div class="car-actions">
        ${qty > 1 && !car.is_sold
          ? `<button class="btn-small btn-success" data-action="sell-one" data-id="${car.id}">Sell 1</button>`
          : `<button class="btn-small" data-action="toggle-sold" data-id="${car.id}" data-sold="${car.is_sold}">${car.is_sold ? "Mark Available" : "Mark Sold"}</button>`
        }
        <div class="qty-controls">
          <button class="btn-qty" data-action="sell-one" data-id="${car.id}">−</button>
          <button class="btn-qty" data-action="add-one" data-id="${car.id}">+</button>
        </div>
        <button class="btn-small btn-danger" data-action="remove-car" data-id="${car.id}">Remove</button>
      </div>
    `;

    container.appendChild(carCard);
  });
}

/* ========= ADD CAR OPTIONS ========= */

/**
 * Show add car options (Shopify / Custom / Cancel)
 */
function showAddCarOptions(eventId) {
  const editContent = document.getElementById("admin-edit-content");
  editContent.innerHTML = `
    <h2>Add Car</h2>
    <p>Choose how to add a car to this event:</p>
    <div class="add-car-options">
      <button class="btn-option" data-action="add-from-shopify" data-id="${eventId}">
        🛒 From Shopify Store
      </button>
      <button class="btn-option" data-action="add-custom" data-id="${eventId}">
        📷 Upload Custom
      </button>
    </div>
    <button data-action="back-to-edit" class="btn-small" style="margin-top: 16px;">Cancel</button>
  `;
}

/* ========= SHOPIFY PICKER (replaces prompt with grid) ========= */

/**
 * Show Shopify product picker with selectable grid
 */
async function showShopifyPicker(eventId) {
  const editContent = document.getElementById("admin-edit-content");

  editContent.innerHTML = `
    <h2>Select Cars from Shopify</h2>
    <div class="admin-notification"></div>
    <div class="shopify-loading">Loading products from store...</div>
  `;

  const shopifyDomain = "d687ec-85.myshopify.com";
  const endpoint = `https://${shopifyDomain}/products.json?limit=250`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    const products = data.products || [];

    if (products.length === 0) {
      editContent.innerHTML = `
        <h2>Shopify Store</h2>
        <p>No products found in the store.</p>
        <button data-action="back-to-edit" class="btn-small">Back</button>
      `;
      return;
    }

    let html = `
      <h2>Select Cars from Shopify</h2>
      <p>Click on products to select them, then click "Add Selected"</p>
      <div class="admin-notification"></div>
      <div class="shopify-grid">
    `;

    products.forEach((p, i) => {
      const defaultImg = p.images[0]?.src || "";
      
      html += `
        <div class="shopify-item" data-product-index="${i}">
          <div class="shopify-item-main">
            <img src="${defaultImg}" alt="${p.title}" />
            <div class="shopify-item-info">
              <p class="shopify-item-name">${p.title}</p>
              <p class="shopify-item-count">${p.variants.length} variant(s)</p>
            </div>
          </div>
          <div class="shopify-variants">
            ${p.variants.map((v, vi) => {
              const variantName = v.title === "Default Title" ? "" : v.title;
              
              // Find image for this variant using featured_image.id
              let variantImg = defaultImg;
              if (v.featured_image && v.featured_image.id) {
                const imgObj = p.images.find(img => img.id === v.featured_image.id);
                if (imgObj) variantImg = imgObj.src;
              }

              return `
                <div class="shopify-variant" 
                     data-action="toggle-variant" 
                     data-product-idx="${i}" 
                     data-variant-idx="${vi}"
                     data-variant-image="${variantImg}">
                  <span class="variant-select-dot"></span>
                  <span class="variant-title">${variantName || 'Standard'}</span>
                  <span class="variant-price">€${v.price}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    html += `
      </div>
      <div class="shopify-actions">
        <button class="btn-small" data-action="add-selected-shopify" data-id="${eventId}">Add Selected</button>
        <button class="btn-small btn-cancel" data-action="back-to-edit">Cancel</button>
      </div>
    `;

    editContent.innerHTML = html;

    // Store products data for later use
    editContent._shopifyProducts = products;
  } catch (err) {
    editContent.innerHTML = `
      <h2>Error</h2>
      <p>Could not fetch Shopify products: ${err.message}</p>
      <button data-action="back-to-edit" class="btn-small">Back</button>
    `;
  }
}

/**
 * Handle adding selected Shopify products
 */
async function handleShopifySelection(eventId) {
  const editContent = document.getElementById("admin-edit-content");
  const products = editContent._shopifyProducts;
  if (!products) return;

  const selectedVariants = editContent.querySelectorAll(".shopify-variant.selected");

  if (selectedVariants.length === 0) {
    notifyAdmin("Please select at least one variant");
    return;
  }

  // Show loading
  const addBtn = editContent.querySelector('[data-action="add-selected-shopify"]');
  const originalText = addBtn.textContent;
  addBtn.textContent = "Adding...";
  addBtn.disabled = true;

  let addedCount = 0;
  for (const item of selectedVariants) {
    const pIdx = parseInt(item.dataset.productIdx);
    const vIdx = parseInt(item.dataset.variantIdx);
    
    const product = products[pIdx];
    const variant = product ? product.variants[vIdx] : null;
    
    if (!product || !variant) continue;

    // Use variant-specific image if available
    const img = item.dataset.variantImage || product.images[0]?.src || "";
    const tags = product.tags || "";
    
    // Attempt to parse color/size from variant title or options
    // Common pattern: "Color / Size" or "Size / Color"
    // Shopify stores these in option1, option2, option3
    let color = variant.option1;
    let size = variant.option2;
    
    // If only one option, it might be either. Let's be smart/generic if we can.
    // For now, let's just use what Shopify gives us.
    
    try {
      await addCarToEvent(eventId, {
        name: product.title,
        image_url: img,
        source: "shopify",
        price: parseFloat(variant.price),
        color: color === "Default Title" ? null : color,
        size: size || null,
        tags: tags
      });
      addedCount++;
    } catch (err) {
      console.error("Error adding variant:", err);
    }
  }

  notifyAdmin(`Added ${addedCount} item(s) to event!`, "success");
  await editEvent(eventId);
}

/* ========= CUSTOM CAR FORM (replaces prompt) ========= */

/**
 * Show custom car form
 */
function showCustomCarForm(eventId) {
  const editContent = document.getElementById("admin-edit-content");
  editContent.innerHTML = `
    <h2>Upload Custom Car</h2>
    <div class="admin-form">
      <label>Car Name</label>
      <input type="text" id="custom-car-name" placeholder="e.g. Ferrari F40" />
      <label>Price (€)</label>
      <input type="number" id="custom-car-price" placeholder="0" step="0.01" />
      <label>Car Image</label>
      <input type="file" id="custom-car-image" accept="image/*" />
      <div id="custom-car-preview"></div>
      <div class="form-actions">
        <button data-action="submit-custom-car" data-id="${eventId}" class="btn-small">Add Car</button>
        <button data-action="back-to-edit" class="btn-small btn-cancel">Cancel</button>
      </div>
    </div>
  `;

  // Image preview
  document.getElementById("custom-car-image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById("custom-car-preview").innerHTML =
          `<img src="${ev.target.result}" style="max-width: 200px; border-radius: 8px; margin-top: 8px;" />`;
      };
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Handle custom car form submission
 */
async function handleCustomCarSubmit(eventId) {
  const name = document.getElementById("custom-car-name").value.trim();
  const price = parseFloat(document.getElementById("custom-car-price").value) || 0;
  const fileInput = document.getElementById("custom-car-image");
  const file = fileInput.files[0];

  if (!name) return alert("Please enter a car name");
  if (!file) return alert("Please select an image");

  try {
    const submitBtn = document.querySelector('[data-action="submit-custom-car"]');
    submitBtn.textContent = "Uploading...";
    submitBtn.disabled = true;

    const imageUrl = await uploadImage(file);

    await addCarToEvent(eventId, {
      name,
      image_url: imageUrl,
      source: "custom",
      price,
    });

    notifyAdmin("Custom car added!", "success");
    await editEvent(eventId);
  } catch (err) {
    notifyAdmin("Error: " + err.message);
  }
}

/* ========= EVENT LOGO UPLOAD ========= */

/**
 * Show logo upload form
 */
function showLogoUploadForm(eventId) {
  const editContent = document.getElementById("admin-edit-content");
  editContent.innerHTML = `
    <h2>Change Event Logo</h2>
    <div class="admin-form">
      <label>Logo Image</label>
      <input type="file" id="event-logo-image" accept="image/*" />
      <div id="event-logo-preview"></div>
      <div class="form-actions">
        <button data-action="submit-logo" data-id="${eventId}" class="btn-small">Upload Logo</button>
        <button data-action="back-to-edit" class="btn-small btn-cancel">Cancel</button>
      </div>
    </div>
  `;

  // Image preview
  document.getElementById("event-logo-image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById("event-logo-preview").innerHTML =
          `<img src="${ev.target.result}" style="max-width: 200px; border-radius: 8px; margin-top: 8px;" />`;
      };
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Handle logo upload submission
 */
async function handleLogoUpload(eventId) {
  const fileInput = document.getElementById("event-logo-image");
  const file = fileInput.files[0];

  if (!file) return alert("Please select an image");

  try {
    const submitBtn = document.querySelector('[data-action="submit-logo"]');
    submitBtn.textContent = "Uploading...";
    submitBtn.disabled = true;

    const imageUrl = await uploadImage(file);

    await updateEvent(eventId, { logo_url: imageUrl });

    notifyAdmin("Logo updated!", "success");
    await editEvent(eventId);
  } catch (err) {
    notifyAdmin("Error: " + err.message);
  }
}

/* ========= SOLD / REMOVE ========= */

async function toggleSoldStatus(carId, currentStatus) {
  try {
    await markCarAsSold(carId, !currentStatus);
    await editEvent(currentEditEventId);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function removeCarUI(carId) {
  const confirmed = await showAdminConfirm(
    "Remove Car",
    "Are you sure you want to remove this car from the event?"
  );

  if (!confirmed) {
    await editEvent(currentEditEventId);
    return;
  }

  try {
    await deleteCar(carId);
    await editEvent(currentEditEventId);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

/* ========= STATS ========= */

async function viewStats(eventId) {
  const statsScreen = document.getElementById("admin-stats-screen");
  showScreen(statsScreen);

  const event = (await getAllEvents()).find((e) => e.id === eventId);
  const stats = await getEventStats(eventId);

  const statsContent = document.getElementById("admin-stats-content");
  statsContent.innerHTML = `
    <div class="stats-header">
      <h2>${event.name} - Statistics</h2>
      <div class="stats-tabs">
        <button class="tab-btn active" data-tab="overview">Overview</button>
        <button class="tab-btn" data-tab="cars">Car Details</button>
        <button class="tab-btn" data-tab="transactions">Transactions</button>
      </div>
    </div>

    <div id="tab-overview" class="stats-tab-content active">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Stock Units</div>
          <div class="stat-value">${stats.totalCars}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Units Sold</div>
          <div class="stat-value">${stats.soldCars}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Units Available</div>
          <div class="stat-value">${stats.availableCars}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sell-Through Rate</div>
          <div class="stat-value">${stats.sellThroughRate}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Est. Total Value</div>
          <div class="stat-value">€${stats.totalValue.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">€${stats.soldValue.toFixed(2)}</div>
        </div>
      </div>
    </div>

    <div id="tab-cars" class="stats-tab-content">
      <h3>Inventory Breakdown</h3>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Car Name</th>
            <th>Source</th>
            <th>Price</th>
            <th>Stock Qty</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${stats.cars
            .map(
              (car) => `
            <tr ${car.is_sold || car.quantity === 0 ? 'class="sold-row"' : ""}>
              <td>${car.name}</td>
              <td>${car.source}</td>
              <td>€${car.price}</td>
              <td>${car.quantity || 1}</td>
              <td>${car.is_sold || car.quantity === 0 ? "SOLD OUT" : "AVAILABLE"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div id="tab-transactions" class="stats-tab-content">
      <h3>Recent Sales</h3>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Car Name</th>
            <th>Sold For</th>
            <th>Date</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${stats.transactions && stats.transactions.length > 0 
            ? stats.transactions.map(t => {
                const date = new Date(t.sold_at);
                return `
                  <tr>
                    <td>${t.car_name}</td>
                    <td>€${t.price}</td>
                    <td>${date.toLocaleDateString("pt-PT")}</td>
                    <td>${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}</td>
                  </tr>
                `;
              }).join("") 
            : '<tr><td colspan="4" style="text-align:center;">No transactions recorded yet</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <div class="stats-footer">
      <button data-action="export-stats" data-id="${eventId}" data-name="${event.name}">Export CSV</button>
      <button data-action="back-to-admin">Back</button>
    </div>
  `;

  // Setup tab logic
  const tabs = statsContent.querySelectorAll(".tab-btn");
  const contents = statsContent.querySelectorAll(".stats-tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      
      tab.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");
    });
  });
}

async function exportEventStats(eventId, eventName) {
  try {
    const stats = await getEventStats(eventId);
    if (!stats) throw new Error("Could not get stats");

    let csv = "Inventory Report\n";
    csv += "Car Name,Source,Price,Quantity,Status\n";
    stats.cars.forEach(c => {
      csv += `"${c.name}","${c.source}",${c.price},${c.quantity || 1},"${c.is_sold ? 'SOLD' : 'AVAILABLE'}"\n`;
    });

    csv += "\nTransaction Log\n";
    csv += "Car Name,Sold For,Date,Time\n";
    if (stats.transactions) {
      stats.transactions.forEach(t => {
        const d = new Date(t.sold_at);
        csv += `"${t.car_name}",${t.price},"${d.toLocaleDateString()}",${d.getHours()}:${d.getMinutes()}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName}-stats.csv`;
    a.click();
  } catch (err) {
    notifyAdmin("Error exporting: " + err.message);
  }
}
