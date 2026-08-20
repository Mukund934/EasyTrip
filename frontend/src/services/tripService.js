import apiClient, { ApiClientError } from './apiClient';

/**
 * The trip workspace API (`IMP-109` / `FV-006`, `ADR-031`).
 *
 * Every path is nested under its trip, mirroring the server: a day and an item are only ever
 * addressable *through* the trip that owns them. No function takes a user id — the owner comes from
 * the verified token, server-side.
 */

const withFallback = (error, fallback) => {
  if (error instanceof ApiClientError && error.status) return error;
  return new ApiClientError(fallback, error?.status, error?.data);
};

const authed = (token) => ({ authToken: token, requireAuth: true });

const listTrips = async (token) => {
  try {
    const { data } = await apiClient.get('/auth/trips', authed(token));
    return data?.trips ?? [];
  } catch (error) {
    throw withFallback(error, 'Could not load your trips');
  }
};

const getTrip = async (tripId, token) => {
  try {
    const { data } = await apiClient.get(`/auth/trips/${tripId}`, authed(token));
    return data?.trip ?? null;
  } catch (error) {
    throw withFallback(error, 'Could not load this trip');
  }
};

/**
 * The deterministic feasibility report for a trip (`FV-025`).
 *
 * A separate call rather than a field on `getTrip`, and that is the design rather than an
 * accident: the workspace reloads the whole trip after every write (see `useTripWorkspace`), and
 * making every add, edit and reorder also recompute a report the user may not be looking at would
 * put work on the critical path of a drag. The check is asked for when it is wanted.
 */
const getTripFeasibility = async (tripId, token) => {
  try {
    const { data } = await apiClient.get(`/auth/trips/${tripId}/feasibility`, authed(token));
    return data?.feasibility ?? null;
  } catch (error) {
    throw withFallback(error, 'Could not check this trip');
  }
};

/**
 * A shorter order for one day, if there is one (`FV-026` stage a).
 *
 * Read-only. Applying a suggestion goes through `reorderItems`, which already exists and already
 * validates — so a suggestion can never become a write this module invented.
 */
/**
 * What to change when the forecast disagrees with the plan (`FV-027` stage b).
 *
 * A read. Applying a proposal is `updateItem` with a `trip_day_id`, which is the same endpoint the
 * workspace already uses for every other edit — so the replan has no privileged write path.
 */
const getTripReplanSuggestion = async (tripId, token) => {
  try {
    const { data } = await apiClient.get(`/auth/trips/${tripId}/replan-suggestion`, authed(token));
    return data.replan;
  } catch (error) {
    throw withFallback(error, 'Could not work out what to change');
  }
};

const getDayRouteSuggestion = async (tripId, dayId, token) => {
  try {
    const { data } = await apiClient.get(
      `/auth/trips/${tripId}/days/${dayId}/route-suggestion`,
      authed(token)
    );
    return data?.suggestion ?? null;
  } catch (error) {
    throw withFallback(error, 'Could not check this day');
  }
};

const createTrip = async (trip, token) => {
  try {
    const { data } = await apiClient.post('/auth/trips', trip, authed(token));
    return data?.trip;
  } catch (error) {
    throw withFallback(error, 'Could not create this trip');
  }
};

const updateTrip = async (tripId, patch, token) => {
  try {
    const { data } = await apiClient.put(`/auth/trips/${tripId}`, patch, authed(token));
    return data?.trip;
  } catch (error) {
    throw withFallback(error, 'Could not update this trip');
  }
};

const deleteTrip = async (tripId, token) => {
  try {
    await apiClient.delete(`/auth/trips/${tripId}`, authed(token));
    return true;
  } catch (error) {
    throw withFallback(error, 'Could not delete this trip');
  }
};

const addDay = async (tripId, token) => {
  try {
    const { data } = await apiClient.post(`/auth/trips/${tripId}/days`, {}, authed(token));
    return data?.day;
  } catch (error) {
    throw withFallback(error, 'Could not add a day');
  }
};

const deleteDay = async (tripId, dayId, token) => {
  try {
    await apiClient.delete(`/auth/trips/${tripId}/days/${dayId}`, authed(token));
    return true;
  } catch (error) {
    throw withFallback(error, 'Could not delete this day');
  }
};

const addItem = async (tripId, dayId, item, token) => {
  try {
    const { data } = await apiClient.post(
      `/auth/trips/${tripId}/days/${dayId}/items`,
      item,
      authed(token)
    );
    return data?.item;
  } catch (error) {
    throw withFallback(error, 'Could not add this item');
  }
};

const updateItem = async (tripId, itemId, patch, token) => {
  try {
    const { data } = await apiClient.put(
      `/auth/trips/${tripId}/items/${itemId}`,
      patch,
      authed(token)
    );
    return data?.item;
  } catch (error) {
    throw withFallback(error, 'Could not update this item');
  }
};

const deleteItem = async (tripId, itemId, token) => {
  try {
    await apiClient.delete(`/auth/trips/${tripId}/items/${itemId}`, authed(token));
    return true;
  } catch (error) {
    throw withFallback(error, 'Could not remove this item');
  }
};

/**
 * Reorder a day's items. Takes the **full** ordered id list, which is what the server requires —
 * a partial list is rejected rather than partially applied, because a partial apply looks like it
 * worked and silently interleaves the omitted items.
 */
const reorderItems = async (tripId, dayId, itemIds, token) => {
  try {
    await apiClient.put(
      `/auth/trips/${tripId}/days/${dayId}/items/order`,
      { item_ids: itemIds },
      authed(token)
    );
    return true;
  } catch (error) {
    throw withFallback(error, 'Could not reorder these items');
  }
};

const tripService = {
  listTrips,
  getTrip,
  getTripFeasibility,
  getTripReplanSuggestion,
  getDayRouteSuggestion,
  createTrip,
  updateTrip,
  deleteTrip,
  addDay,
  deleteDay,
  addItem,
  updateItem,
  deleteItem,
  reorderItems
};

export default tripService;
export {
  listTrips,
  getTrip,
  getTripFeasibility,
  getTripReplanSuggestion,
  getDayRouteSuggestion,
  createTrip,
  updateTrip,
  deleteTrip,
  addDay,
  deleteDay,
  addItem,
  updateItem,
  deleteItem,
  reorderItems
};
