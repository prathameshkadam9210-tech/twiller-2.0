import axios from "axios";

const configuredBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5000";

const backendUrl =
  typeof window !== "undefined" &&
  configuredBackendUrl &&
  new URL(configuredBackendUrl, window.location.origin).origin === window.location.origin
    ? "http://localhost:5000"
    : configuredBackendUrl;

if (!process.env.NEXT_PUBLIC_BACKEND_URL && !process.env.BACKEND_URL) {
  console.warn(
    "Axios warning: BACKEND URL is not set. Defaulting to http://localhost:5000. Add NEXT_PUBLIC_BACKEND_URL to twiller/.env.local for production."
  );
}

const axiosInstance = axios.create({
  baseURL: backendUrl,
  timeout: 15000,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ERR_NETWORK") {
      error.message = `Cannot connect to the backend API at ${backendUrl}. Start the backend server and check MONGODB_URL in backend/.env.`;
    }
    if (error.code === "ECONNABORTED") {
      error.message = `The backend API at ${backendUrl} took too long to respond. Check the backend server and MongoDB connection.`;
    }
    if (error.response?.status === 404) {
      const base = error.config?.baseURL || backendUrl;
      error.message = `Backend route not found (${base}${error.config?.url || ""}). Make sure the Express backend is running on port 5000 and NEXT_PUBLIC_BACKEND_URL points to it.`;
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
