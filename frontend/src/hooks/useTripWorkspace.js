import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '../context/AuthContext';
import tripService from '../services/tripService';

/**
 * One trip's workspace — days, items, and the operations on them (`IMP-109`, `ADR-031`).
 *
 * **Everything reloads from the server after a write.** That is a deliberate choice over patching
 * local state: a day delete renumbers every later day server-side, and an item add computes its
 * position there too. Mirroring that arithmetic in the client would be a second implementation of
 * rules the database already owns — and the first time the two disagreed, the screen would be
 * confidently wrong.
 *
 * The exception is `reorder`, which *is* optimistic, because a drag that snaps back for 300ms is
 * the one interaction where latency is unmistakably a bug. It reverts on failure.
 */
export function useTripWorkspace(tripId) {
  const { currentUser, loading: authLoading, getIdToken } = useAuth();

  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!tripId) return null;
    setError(null);
    try {
      const token = await getIdToken();
      const loaded = await tripService.getTrip(tripId, token);
      setTrip(loaded);
      return loaded;
    } catch (loadError) {
      setError(loadError);
      return null;
    } finally {
      setReady(true);
    }
  }, [tripId, getIdToken]);

  useEffect(() => {
    if (authLoading || !tripId) return;
    if (!currentUser) {
      setReady(true);
      return;
    }
    refresh();
  }, [authLoading, currentUser, tripId, refresh]);

  /** Run a write, then reload. `busy` disables the controls so a double-click cannot double-write. */
  const run = useCallback(
    async (operation) => {
      setBusy(true);
      setActionError(null);
      try {
        const token = await getIdToken();
        await operation(token);
        await refresh();
        return true;
      } catch (writeError) {
        setActionError(writeError);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [getIdToken, refresh]
  );

  const addDay = useCallback(
    () => run((token) => tripService.addDay(tripId, token)),
    [run, tripId]
  );

  const removeDay = useCallback(
    (dayId) => run((token) => tripService.deleteDay(tripId, dayId, token)),
    [run, tripId]
  );

  const addItem = useCallback(
    (dayId, item) => run((token) => tripService.addItem(tripId, dayId, item, token)),
    [run, tripId]
  );

  const updateItem = useCallback(
    (itemId, patch) => run((token) => tripService.updateItem(tripId, itemId, patch, token)),
    [run, tripId]
  );

  const removeItem = useCallback(
    (itemId) => run((token) => tripService.deleteItem(tripId, itemId, token)),
    [run, tripId]
  );

  const updateTrip = useCallback(
    (patch) => run((token) => tripService.updateTrip(tripId, patch, token)),
    [run, tripId]
  );

  /**
   * Move an item up or down within its day.
   *
   * Optimistic, and it sends the **whole** resulting order — which is what the server requires. A
   * "move item X by one" API would make the server reconstruct the rest, which is the same
   * information arriving less reliably.
   */
  const moveItem = useCallback(
    async (dayId, itemId, direction) => {
      const day = trip?.days?.find((candidate) => candidate.id === dayId);
      if (!day) return false;

      const ids = day.items.map((item) => item.id);
      const from = ids.indexOf(itemId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return false;

      const reordered = [...ids];
      [reordered[from], reordered[to]] = [reordered[to], reordered[from]];

      const previous = trip;
      setTrip((current) => ({
        ...current,
        days: current.days.map((candidate) =>
          candidate.id === dayId
            ? {
                ...candidate,
                items: reordered.map((id) => candidate.items.find((item) => item.id === id))
              }
            : candidate
        )
      }));

      try {
        const token = await getIdToken();
        await tripService.reorderItems(tripId, dayId, reordered, token);
        return true;
      } catch (reorderError) {
        // Snap back to what the server still holds. Leaving the optimistic order on screen would
        // show an arrangement that does not exist.
        setTrip(previous);
        setActionError(reorderError);
        return false;
      }
    },
    [trip, tripId, getIdToken]
  );

  return {
    trip,
    error,
    actionError,
    busy,
    ready: ready && !authLoading,
    refresh,
    updateTrip,
    addDay,
    removeDay,
    addItem,
    updateItem,
    removeItem,
    moveItem
  };
}
