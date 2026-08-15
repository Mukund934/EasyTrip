import apiClient from './apiClient';

/**
 * Admin-user management (IMP-072).
 *
 * Three things changed here, all of them removals:
 *
 * 1. **The base URL is gone.** This module read `process.env.NEXT_PUBLIC_API_URL` with no
 *    fallback, so with the variable unset every request went to the literal string
 *    `undefined/admin/places`. The shared client resolves the URL once (`apiConfig.js`).
 *
 * 2. **The Authorization header is gone.** It was built by hand at six call sites here alone.
 *    `apiClient`'s request interceptor attaches it now — one place to get right, which is the
 *    point of `IMP-003`'s fix rather than a restatement of it.
 *
 * 3. **`addPlace`, `updatePlace` and `deletePlace` are gone.** They duplicated
 *    `placeService.createPlace/updatePlace/deletePlace`, and nothing imported them: the only
 *    consumer of this module is `pages/admin/users.jsx`, which uses the three admin-management
 *    functions below. The place-management pages have always used `placeService`. Two
 *    implementations of one feature, one of them wired — the same shape as the profile vertical
 *    deleted in Sprint 5.1.
 *
 * `token` is still an explicit parameter. The pages hold one from `AuthContext` already, and
 * passing it lets the interceptor skip a second SDK round trip; omitting it is also fine, since
 * the interceptor falls back to asking Firebase.
 */

/** Every admin (id, email, name). Returns the raw array the API sends. */
const getAllAdmins = async (token) => {
  const response = await apiClient.get('/admin/admins', { authToken: token, requireAuth: true });
  return response.data;
};

/** Grant admin rights to an existing user by email. */
const addAdmin = async (token, email) => {
  const response = await apiClient.post(
    '/admin/admins',
    { email },
    { authToken: token, requireAuth: true }
  );
  return response.data;
};

/** Revoke admin rights. The email is a path segment, so it must be encoded. */
const removeAdmin = async (token, email) => {
  const response = await apiClient.delete(`/admin/admins/${encodeURIComponent(email)}`, {
    authToken: token,
    requireAuth: true
  });
  return response.data;
};

/**
 * Look up coordinates for a free-text address (`IMP-116`).
 *
 * Returns `{ results, status }` where `status` is `exact` · `ambiguous` · `no_match`. The server
 * derives that rather than the caller counting `results.length`, so the three cases cannot be
 * classified differently by two clients.
 */
const geocode = async (token, query) => {
  const response = await apiClient.get(`/admin/geocode?q=${encodeURIComponent(query)}`, {
    authToken: token,
    requireAuth: true
  });
  return response.data;
};

export const adminService = {
  addAdmin,
  removeAdmin,
  getAllAdmins,
  geocode
};
