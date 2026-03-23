import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Auth
export const getMe = () => api.get("/auth/me").then((r) => r.data);
export const logout = () => api.post("/auth/logout");
export const switchUser = (userId: string) => api.post(`/auth/switch-user/${userId}`);
export const switchBack = () => api.post("/auth/switch-back");

// Locations
export const getLocations = () => api.get("/locations").then((r) => r.data);
export const getLocation = (id: string) => api.get(`/locations/${id}`).then((r) => r.data);
export const syncLocations = () => api.post("/locations/sync").then((r) => r.data);
export const getClients = () => api.get("/locations/admin/clients").then((r) => r.data);

// Reviews
export const getReviews = (locationId: string, filter = "all", page = 1) =>
  api.get(`/reviews/location/${locationId}?filter=${filter}&page=${page}`).then((r) => r.data);
export const syncReviews = (locationId: string) =>
  api.post(`/reviews/location/${locationId}/sync`).then((r) => r.data);
export const generateReply = (reviewId: string) =>
  api.post(`/reviews/${reviewId}/generate-reply`).then((r) => r.data);
export const postReply = (reviewId: string, text: string, source = "manual") =>
  api.post(`/reviews/${reviewId}/reply`, { text, source }).then((r) => r.data);
export const getFlaggedReviews = () => api.get("/reviews/admin/flagged").then((r) => r.data);

// Templates
export const getTemplates = (locationId: string) =>
  api.get(`/templates/location/${locationId}`).then((r) => r.data);
export const createTemplate = (data: { location_id: string; name: string; category: string; body_text: string }) =>
  api.post("/templates", data).then((r) => r.data);
export const updateTemplate = (id: string, data: { name: string; category: string; body_text: string }) =>
  api.put(`/templates/${id}`, data).then((r) => r.data);
export const deleteTemplate = (id: string) => api.delete(`/templates/${id}`);
export const applyTemplate = (id: string, data: { reviewer_name: string; business_name: string }) =>
  api.post(`/templates/${id}/apply`, data).then((r) => r.data);

// Guidelines
export const getGuidelines = (locationId: string) =>
  api.get(`/guidelines/location/${locationId}`).then((r) => r.data);
export const updateGuidelines = (locationId: string, data: any) =>
  api.put(`/guidelines/location/${locationId}`, data).then((r) => r.data);
