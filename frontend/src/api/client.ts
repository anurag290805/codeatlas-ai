// src/api/client.ts
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

/**
 * Singleton Axios client used for all backend communication with the
 * FastAPI application. Only files inside `src/api/` may import this
 * client, per the Component -> Hook -> API Service -> Axios Client
 * architecture.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error),
);