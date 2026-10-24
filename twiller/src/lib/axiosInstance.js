import axios from "axios";

const isBrowser = typeof window !== "undefined";

// Production API (Render). Swap to http://localhost:5000 only when running
// the Next.js dev server locally on localhost.
const PRODUCTION_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://twiller-2-0-838w.onrender.com";

const backendUrl = isBrowser
  ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : PRODUCTION_BACKEND_URL
  : PRODUCTION_BACKEND_URL;

const axiosInstance = axios.create({
  baseURL: backendUrl,
  // Render free instances can need more than 15 seconds to wake after inactivity.
  timeout: 60000,
});

// Retry safe GETs on network errors while a Render instance is waking up.
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.code === "ERR_NETWORK" &&
      config &&
      config.method?.toLowerCase() === "get" &&
      !config._retried
    ) {
      config._retried = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return axiosInstance(config);
    }
    if (error.code === "ERR_NETWORK") {
      error.message = `Cannot connect to the backend API at ${backendUrl}. Start the backend server and check MONGODB_URL in backend/.env.`;
    }
    if (error.code === "ECONNABORTED") {
      error.message = `The backend API at ${backendUrl} did not respond within 60 seconds. Check the Render service logs and database connection, then try again.`;
    }
    if (error.response?.status === 404) {
      const base = error.config?.baseURL || backendUrl;
      error.message = `Backend route not found (${base}${error.config?.url || ""}). Make sure the Express backend is running and NEXT_PUBLIC_BACKEND_URL points to it.`;
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
