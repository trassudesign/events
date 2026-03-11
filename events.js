/* ========= EVENTS MODULE ========= */

import { supabaseFetch } from "./config.js";

/* ========= EVENT MANAGEMENT ========= */

/**
 * Get all events
 */
export async function getAllEvents() {
  try {
    const events = await supabaseFetch("/events?order=is_active.desc,date.desc");
    return events;
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
}

/**
 * Get active event
 */
export async function getActiveEvent() {
  try {
    const events = await supabaseFetch("/events?is_active=eq.true");
    return events.length > 0 ? events[0] : null;
  } catch (err) {
    console.error("Error fetching active event:", err);
    return null;
  }
}

/**
 * Create new event
 */
export async function createEvent(name, date, logoUrl = null) {
  try {
    const result = await supabaseFetch("/events", {
      method: "POST",
      body: JSON.stringify({
        name,
        date: date || new Date().toISOString(),
        is_active: false,
        logo_url: logoUrl,
        show_quiz: true,
        show_online_store: true,
      }),
    });
    return result[0];
  } catch (err) {
    console.error("Error creating event:", err);
    throw err;
  }
}

/**
 * Update event
 */
export async function updateEvent(eventId, data) {
  try {
    const result = await supabaseFetch(`/events?id=eq.${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return result[0];
  } catch (err) {
    console.error("Error updating event:", err);
    throw err;
  }
}

/**
 * Set event as active (only one can be active)
 */
export async function setActiveEvent(eventId) {
  try {
    // First, deactivate all events
    await supabaseFetch("/events?is_active=eq.true", {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });

    // Then activate the selected one
    const result = await supabaseFetch(`/events?id=eq.${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: true }),
    });
    return result[0];
  } catch (err) {
    console.error("Error setting active event:", err);
    throw err;
  }
}

/**
 * Duplicate event (copy event and all its cars)
 */
export async function duplicateEvent(eventId, newName) {
  try {
    // Get source event
    const sourceEvent = await supabaseFetch(`/events?id=eq.${eventId}`);
    if (!sourceEvent.length) throw new Error("Event not found");

    const source = sourceEvent[0];

    // Create new event
    const newEvent = await createEvent(newName, source.date);
    
    // Copy show_quiz and show_online_store settings
    await updateEvent(newEvent.id, {
      show_quiz: source.show_quiz,
      show_online_store: source.show_online_store !== false,
    });

    // Get source event's cars
    const cars = await supabaseFetch(`/cars?event_id=eq.${eventId}`);

    // Copy cars to new event (don't copy sold status)
    for (const car of cars) {
      await supabaseFetch("/cars", {
        method: "POST",
        body: JSON.stringify({
          event_id: newEvent.id,
          name: car.name,
          image_url: car.image_url,
          source: car.source,
          price: car.price,
          is_sold: false, // Reset sold status
          color: car.color,
          size: car.size,
          quantity: car.quantity,
          tags: car.tags
        }),
      });
    }

    return newEvent;
  } catch (err) {
    console.error("Error duplicating event:", err);
    throw err;
  }
}

/**
 * Delete event and all its cars
 */
export async function deleteEvent(eventId) {
  try {
    // Cars will auto-delete via ON DELETE CASCADE
    const result = await supabaseFetch(`/events?id=eq.${eventId}`, {
      method: "DELETE",
    });
    return result;
  } catch (err) {
    console.error("Error deleting event:", err);
    throw err;
  }
}

/* ========= CAR MANAGEMENT ========= */

/**
 * Get all cars for an event
 */
export async function getEventCars(eventId) {
  try {
    const cars = await supabaseFetch(
      `/cars?event_id=eq.${eventId}&order=created_at.asc`,
    );
    return cars;
  } catch (err) {
    console.error("Error fetching event cars:", err);
    return [];
  }
}

/**
 * Add car to event
 */
export async function addCarToEvent(eventId, carData) {
  try {
    // 1. Check if an identical car variant already exists in this event
    // (Same name, color, and size)
    const existingCars = await supabaseFetch(
      `/cars?event_id=eq.${eventId}&name=eq.${encodeURIComponent(carData.name)}` +
      (carData.color ? `&color=eq.${encodeURIComponent(carData.color)}` : `&color=is.null`) +
      (carData.size ? `&size=eq.${encodeURIComponent(carData.size)}` : `&size=is.null`)
    );

    if (existingCars && existingCars.length > 0) {
      const existing = existingCars[0];
      // Increment quantity
      const updated = await supabaseFetch(`/cars?id=eq.${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: (existing.quantity || 1) + 1,
          is_sold: false, // Ensure it's marked available if adding more
        }),
      });
      return updated[0];
    }

    // 2. Otherwise, create new car entry
    const result = await supabaseFetch("/cars", {
      method: "POST",
      body: JSON.stringify({
        event_id: eventId,
        name: carData.name,
        image_url: carData.image_url,
        source: carData.source, // 'shopify' or 'custom'
        price: carData.price || 0,
        is_sold: false,
        color: carData.color || null,
        size: carData.size || null,
        quantity: 1,
        tags: carData.tags || null
      }),
    });
    return result[0];
  } catch (err) {
    console.error("Error adding car:", err);
    throw err;
  }
}

/**
 * Mark car as sold
 */
export async function markCarAsSold(carId, isSold = true) {
  try {
    const carRes = await supabaseFetch(`/cars?id=eq.${carId}`);
    const car = carRes[0];

    const result = await supabaseFetch(`/cars?id=eq.${carId}`, {
      method: "PATCH",
      body: JSON.stringify({
        is_sold: isSold,
        sold_at: isSold ? new Date().toISOString() : null,
      }),
    });

    if (isSold && car) {
      await recordTransaction(car.id, car.event_id, car.name, car.price);
    }

    return result[0];
  } catch (err) {
    console.error("Error marking car as sold:", err);
    throw err;
  }
}

/**
 * Record a new transaction
 */
export async function recordTransaction(carId, eventId, carName, price) {
  try {
    await supabaseFetch("/transactions", {
      method: "POST",
      body: JSON.stringify({
        car_id: carId,
        event_id: eventId,
        car_name: carName,
        price: price,
        sold_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("Error recording transaction:", err);
  }
}

/**
 * Get all transactions for an event
 */
export async function getEventTransactions(eventId) {
  try {
    return await supabaseFetch(`/transactions?event_id=eq.${eventId}&order=sold_at.desc`);
  } catch (err) {
    console.error("Error getting transactions:", err);
    return [];
  }
}

/**
 * Delete car from event
 */
export async function deleteCar(carId) {
  try {
    await supabaseFetch(`/cars?id=eq.${carId}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("Error deleting car:", err);
    throw err;
  }
}

/* ========= ANALYTICS ========= */

/**
 * Get event statistics
 */
export async function getEventStats(eventId) {
  try {
    const cars = await getEventCars(eventId);
    const transactions = await getEventTransactions(eventId);
    
    const totalCars = cars.reduce((sum, c) => sum + (c.quantity || 1), 0);
    const soldCars = transactions.length;
    
    const sellThroughRate =
      totalCars > 0 ? ((soldCars / totalCars) * 100).toFixed(1) : 0;
      
    // Total value based on initial stock
    const totalValue = cars.reduce((sum, c) => sum + ((c.price || 0) * (c.quantity || 1)), 0);
    
    // Sold value based on actual transactions
    const soldValue = transactions.reduce((sum, t) => sum + (t.price || 0), 0);

    return {
      totalCars,
      soldCars,
      availableCars: Math.max(0, totalCars - soldCars),
      sellThroughRate,
      totalValue,
      soldValue,
      cars,
      transactions,
    };
  } catch (err) {
    console.error("Error getting event stats:", err);
    return null;
  }
}

/**
 * Export event data to CSV
 */
export async function exportEventToCSV(eventId, eventName) {
  try {
    const stats = await getEventStats(eventId);
    if (!stats) throw new Error("Could not get event stats");

    const { cars } = stats;
    let csv = "Car Name,Source,Price,Status,Sold At\n";

    cars.forEach((car) => {
      const status = car.is_sold ? "SOLD" : "AVAILABLE";
      const soldDate = car.sold_at
        ? new Date(car.sold_at).toLocaleDateString("pt-PT")
        : "-";
      csv += `"${car.name}","${car.source}",${car.price},"${status}","${soldDate}"\n`;
    });

    // Add summary
    csv += "\n,,,,\n";
    csv += `Summary,,,,\n`;
    csv += `Total Cars,${stats.totalCars},,,\n`;
    csv += `Sold,${stats.soldCars},,,\n`;
    csv += `Available,${stats.availableCars},,,\n`;
    csv += `Sell-Through Rate,${stats.sellThroughRate}%,,,\n`;
    csv += `Total Value,€${stats.totalValue.toFixed(2)},,,\n`;
    csv += `Sold Value,€${stats.soldValue.toFixed(2)},,,\n`;

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error exporting CSV:", err);
    throw err;
  }
}
