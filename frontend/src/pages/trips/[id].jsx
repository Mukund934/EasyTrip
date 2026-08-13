import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiAlertCircle,
  FiChevronUp,
  FiChevronDown,
  FiClock,
  FiMapPin
} from 'react-icons/fi';

import { useAuth } from '../../context/AuthContext';
import { useTripWorkspace } from '../../hooks/useTripWorkspace';
import { useWishlist } from '../../hooks/useWishlist';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/dateFormat';

/**
 * One trip's workspace (`IMP-109` / `FV-006`, `ADR-031`).
 *
 * Days down the page, ordered items inside each. Saved places are offered as the source for new
 * items, which is the whole point of `IMP-108` existing first — discovery feeds planning.
 *
 * Reordering is up/down buttons rather than drag-and-drop, deliberately: a keyboard user and a
 * screen-reader user can both reorder, and the server contract (send the full order) is identical
 * either way, so a drag layer can be added later without touching the API.
 */

/** The calendar date of a day, computed from the trip's start (`ADR-031` — days store an ordinal). */
const dayDate = (trip, dayNumber) => {
  if (!trip.start_date) return null;
  const date = new Date(trip.start_date);
  date.setDate(date.getDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
};

const AddItemForm = ({ dayId, savedPlaces, busy, onAdd }) => {
  const [placeId, setPlaceId] = useState('');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const added = await onAdd(dayId, {
      place_id: placeId ? Number(placeId) : undefined,
      title: title.trim() || undefined,
      start_time: startTime || undefined,
      item_type: placeId ? 'place' : 'activity'
    });
    if (added) {
      setPlaceId('');
      setTitle('');
      setStartTime('');
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-4" aria-label="Add an item">
      <label className="sr-only" htmlFor={`place-${dayId}`}>
        Saved place
      </label>
      <select
        id={`place-${dayId}`}
        value={placeId}
        onChange={(event) => setPlaceId(event.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">A saved place…</option>
        {savedPlaces.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`title-${dayId}`}>
        Or your own description
      </label>
      <input
        id={`title-${dayId}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="…or type something else"
        maxLength={200}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
      />

      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`time-${dayId}`}>
          Start time
        </label>
        <input
          id={`time-${dayId}`}
          type="time"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || (!placeId && !title.trim())}
          className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <FiPlus className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Add item</span>
        </button>
      </div>
    </form>
  );
};

export default function TripWorkspace() {
  const router = useRouter();
  const { id } = router.query;
  const { currentUser, loading: authLoading } = useAuth();

  const {
    trip,
    error,
    actionError,
    busy,
    ready,
    refresh,
    addDay,
    removeDay,
    addItem,
    removeItem,
    moveItem
  } = useTripWorkspace(id);
  const { places: savedPlaces } = useWishlist();

  useEffect(() => {
    if (!authLoading && !currentUser) router.push('/login');
  }, [authLoading, currentUser, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // A trip that is not yours and a trip that does not exist answer alike, by design — so this
  // page says the same thing for both rather than guessing which it was.
  if (error || !trip) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <FiAlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-serif font-bold text-gray-900">
            {error?.status === 404 || !trip ? 'Trip not found' : 'We could not load this trip'}
          </h1>
          <p className="mt-2 text-gray-600">
            {error?.status === 404 || !trip
              ? 'It may have been deleted, or it belongs to someone else.'
              : 'Nothing has been lost — this is a problem reaching the server.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {error && error.status !== 404 && (
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white hover:bg-primary-700"
              >
                Try again
              </button>
            )}
            <Link
              href="/trips"
              className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to my trips
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{trip.title} · EasyTrip</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="bg-gray-50 min-h-screen">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href="/trips"
            className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600"
          >
            <FiArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            My trips
          </Link>

          <header className="mt-4 mb-8">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900">
              {trip.title}
            </h1>
            {trip.start_date && (
              <p className="mt-2 text-gray-600">
                {formatDate(trip.start_date)}
                {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ''}
              </p>
            )}
          </header>

          {actionError && (
            <div
              role="alert"
              className="mb-6 flex items-start rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <FiAlertCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{actionError.message}</span>
            </div>
          )}

          <div className="space-y-6">
            {trip.days.map((day) => (
              <section
                key={day.id}
                aria-labelledby={`day-${day.id}`}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3">
                  <h2 id={`day-${day.id}`} className="font-serif text-xl font-bold text-gray-900">
                    Day {day.day_number}
                    {dayDate(trip, day.day_number) && (
                      <span className="ml-2 text-sm font-sans font-normal text-gray-500">
                        {formatDate(dayDate(trip, day.day_number))}
                      </span>
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() => removeDay(day.id)}
                    disabled={busy}
                    className="inline-flex items-center rounded-lg border border-red-200 px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Delete day ${day.day_number}`}
                  >
                    <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {day.items.length === 0 ? (
                  <p className="py-4 text-sm text-gray-500">
                    Nothing planned yet. Add a saved place, or anything else you want to remember.
                  </p>
                ) : (
                  <ol className="divide-y divide-gray-100">
                    {day.items.map((item, index) => (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => moveItem(day.id, item.id, -1)}
                            disabled={busy || index === 0}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                            aria-label={`Move ${item.title} earlier`}
                          >
                            <FiChevronUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(day.id, item.id, 1)}
                            disabled={busy || index === day.items.length - 1}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                            aria-label={`Move ${item.title} later`}
                          >
                            <FiChevronDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2">
                            {item.start_time && (
                              <span className="inline-flex items-center text-sm font-medium text-primary-700">
                                <FiClock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                {String(item.start_time).slice(0, 5)}
                              </span>
                            )}
                            {/* The link only appears when the place still exists. `ADR-031` sets
                                `place_id` to NULL when a place is deleted — the plan survives, the
                                link does not, and a dead link would be worse than no link. */}
                            {item.place_id ? (
                              <Link
                                href={`/places/${item.place_id}`}
                                className="font-medium text-gray-900 hover:text-primary-600"
                              >
                                {item.title}
                              </Link>
                            ) : (
                              <span className="font-medium text-gray-900">{item.title}</span>
                            )}
                          </div>
                          {item.place_location && (
                            <p className="mt-0.5 flex items-center truncate text-sm text-gray-500">
                              <FiMapPin className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                              {item.place_location}
                            </p>
                          )}
                          {item.notes && <p className="mt-1 text-sm text-gray-600">{item.notes}</p>}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={busy}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          aria-label={`Remove ${item.title}`}
                        >
                          <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}

                <AddItemForm dayId={day.id} savedPlaces={savedPlaces} busy={busy} onAdd={addItem} />
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={addDay}
            disabled={busy}
            className="mt-6 inline-flex items-center rounded-lg border border-dashed border-gray-300 px-5 py-3 font-medium text-gray-700 hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"
          >
            <FiPlus className="mr-2 h-5 w-5" aria-hidden="true" />
            Add day {trip.days.length + 1}
          </button>
        </div>
      </div>
    </>
  );
}
