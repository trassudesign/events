/* ========= SUPABASE CONFIG ========= */

const SUPABASE_URL = "https://yjduzbjwehrqimzsvfaw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZHV6Ymp3ZWhycWltenN2ZmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzQyNzIsImV4cCI6MjA4ODE1MDI3Mn0.ci67ECRvoLtJjfR91MrJZZwHeVZYdyzcEThtg0UO69s";

export const supabaseClient = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
};

/* ========= HELPER FUNCTIONS ========= */

/**
 * Generic fetch wrapper for Supabase REST API
 */
export async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Tell Supabase to return created/updated rows
  if (method === "POST" || method === "PATCH") {
    headers["Prefer"] = "return=representation";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.statusText}`);
  }

  // Handle empty responses (e.g. 204 No Content from DELETE)
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Supabase Auth API helpers
 */
export async function supabaseSignIn(email, password) {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error_description || err.message || "Failed to sign in");
  }

  const data = await response.json();
  // Save session info
  localStorage.setItem("supabase.auth.token", JSON.stringify(data));
  return data;
}

export function supabaseSignOut() {
  localStorage.removeItem("supabase.auth.token");
}

export function getSupabaseSession() {
  const session = localStorage.getItem("supabase.auth.token");
  if (!session) return null;
  try {
    const parsed = JSON.parse(session);
    // Basic check if token exists
    return parsed.access_token ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(file, bucket = "car-images") {
  const fileName = `${Date.now()}-${file.name}`;
  const formData = new FormData();
  formData.append("file", file);

  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload image");
  }

  // Return public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}

/**
 * Get public image URL from file path
 */
export function getImageUrl(filePath, bucket = "car-images") {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
}
