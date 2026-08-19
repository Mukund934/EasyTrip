const tripModel = require('../models/tripModel');
const feasibilityService = require('../services/feasibilityService');
const routeOrderService = require('../services/routeOrderService');
const tripForecastService = require('../services/tripForecastService');
const logger = require('../utils/logger');

/**
 * The trip workspace endpoints (`IMP-109` / `FV-006`, `ADR-031`).
 *
 * **One rule, as with the wishlist and the review history:** the owner is `req.user.uid`, derived
 * from a verified token, and no handler reads a user id from the body, the query or the path. The
 * model refuses to offer a query that is not scoped, so there is no arrangement of arguments that
 * reaches another person's trip.
 *
 * **404, never 403.** A trip that belongs to somebody else answers exactly as one that does not
 * exist. A 403 would confirm the id is real, which turns sequential ids into an enumeration oracle
 * for how many trips the site has and which ones exist — the same reasoning `SECURITY_AUDIT` used
 * for the deliberate 403-vs-404 split on reviews, applied in the opposite direction because a trip,
 * unlike a review, is not public in the first place.
 */
const FOREIGN_KEY_VIOLATION = '23503';

const notFound = (res) => res.status(404).json({ message: 'Trip not found' });

/** GET /api/auth/trips */
const listTrips = async (req, res) => {
  try {
    const trips = await tripModel.listTrips(req.user.uid);
    res.status(200).json({ trips });
  } catch (error) {
    logger.error({ err: error }, 'Error listing trips');
    res.status(500).json({ message: 'Error loading your trips' });
  }
};

/** GET /api/auth/trips/:tripId — the whole workspace: trip, days, items. */
const getTrip = async (req, res) => {
  try {
    const trip = await tripModel.getTripWorkspace(req.user.uid, Number(req.params.tripId));
    if (!trip) return notFound(res);

    res.status(200).json({ trip });
  } catch (error) {
    logger.error({ err: error }, 'Error loading trip');
    res.status(500).json({ message: 'Error loading this trip' });
  }
};

/**
 * GET /api/auth/trips/:tripId/feasibility
 *
 * The deterministic answer to *"can this plan actually be completed?"* (`FV-025`).
 *
 * A **read**, not a gate on saving. The workspace lets somebody build a plan in whatever order
 * suits them, and an editor that refuses a half-finished day is an editor people stop using — the
 * item's own kill criteria warn against exactly that ("validation becomes slow enough to make
 * saving a trip feel broken"). So this reports; the caller decides what to do with the report.
 *
 * Ownership comes from the same `getTripWorkspace` every other trip read uses, so a trip that is
 * not yours is a 404 here for the same reason and by the same query.
 *
 * **The one thing here that is not pure arithmetic is the weather** (`FV-031` daylight, `FV-027`
 * rain). Both rules need a fact about a coordinate on a date rather than anything the plan
 * contains — so `tripForecastService` fetches it and hands the engine plain data, and the engine
 * stays a function of its argument. A day with no reading (no outdoor item, no coordinates, or a
 * date past the provider's seven-day horizon) simply arrives without one, and produces no
 * weather-derived finding rather than an assumed one.
 */
const getTripFeasibility = async (req, res) => {
  try {
    const trip = await tripModel.getTripWorkspace(req.user.uid, Number(req.params.tripId));
    if (!trip) return notFound(res);

    const withForecast = await tripForecastService.attachForecast(trip);
    res.status(200).json({ feasibility: feasibilityService.checkTrip(withForecast) });
  } catch (error) {
    logger.error({ err: error }, 'Error checking trip feasibility');
    res.status(500).json({ message: 'Error checking this trip' });
  }
};

/**
 * GET /api/auth/trips/:tripId/days/:dayId/route-suggestion
 *
 * What a better order for this day would be, and by how much (`FV-026` stage a).
 *
 * **A proposal, not a write.** The item's kill criteria say to stop if *"optimisation starts
 * overriding what the user deliberately chose"*, so applying a suggestion goes through the reorder
 * endpoint that already exists — same authorisation, same validation, and the user's decision in
 * between. It also means this route adds no new way to change a trip.
 */
const getDayRouteSuggestion = async (req, res) => {
  try {
    const trip = await tripModel.getTripWorkspace(req.user.uid, Number(req.params.tripId));
    if (!trip) return notFound(res);

    const day = trip.days.find((candidate) => candidate.id === Number(req.params.dayId));
    if (!day) return notFound(res);

    res.status(200).json({ suggestion: routeOrderService.suggestDayOrder(day) });
  } catch (error) {
    logger.error({ err: error }, 'Error suggesting a day order');
    res.status(500).json({ message: 'Error checking this day' });
  }
};

/** POST /api/auth/trips */
const createTrip = async (req, res) => {
  try {
    const trip = await tripModel.createTrip(req.user.uid, req.body);
    res.status(201).json({ trip });
  } catch (error) {
    logger.error({ err: error }, 'Error creating trip');
    res.status(500).json({ message: 'Error creating this trip' });
  }
};

/** PUT /api/auth/trips/:tripId */
const updateTrip = async (req, res) => {
  try {
    const trip = await tripModel.updateTrip(req.user.uid, Number(req.params.tripId), req.body);
    if (!trip) return notFound(res);

    res.status(200).json({ trip });
  } catch (error) {
    logger.error({ err: error }, 'Error updating trip');
    res.status(500).json({ message: 'Error updating this trip' });
  }
};

/** DELETE /api/auth/trips/:tripId */
const deleteTrip = async (req, res) => {
  try {
    const removed = await tripModel.deleteTrip(req.user.uid, Number(req.params.tripId));
    if (!removed) return notFound(res);

    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting trip');
    res.status(500).json({ message: 'Error deleting this trip' });
  }
};

/** POST /api/auth/trips/:tripId/days */
const addDay = async (req, res) => {
  try {
    const day = await tripModel.addDay(req.user.uid, Number(req.params.tripId));
    if (!day) return notFound(res);

    res.status(201).json({ day });
  } catch (error) {
    logger.error({ err: error }, 'Error adding day');
    res.status(500).json({ message: 'Error adding a day' });
  }
};

/** DELETE /api/auth/trips/:tripId/days/:dayId */
const deleteDay = async (req, res) => {
  try {
    const removed = await tripModel.deleteDay(
      req.user.uid,
      Number(req.params.tripId),
      Number(req.params.dayId)
    );
    if (!removed) return notFound(res);

    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting day');
    res.status(500).json({ message: 'Error deleting this day' });
  }
};

/** POST /api/auth/trips/:tripId/days/:dayId/items */
const addItem = async (req, res) => {
  try {
    const item = await tripModel.addItem(
      req.user.uid,
      Number(req.params.tripId),
      Number(req.params.dayId),
      req.body
    );
    if (!item) return notFound(res);

    res.status(201).json({ item });
  } catch (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      // The place id names nothing. The foreign key rejected it, so no orphan row exists.
      return res.status(404).json({ message: 'Place not found' });
    }

    logger.error({ err: error }, 'Error adding trip item');
    res.status(500).json({ message: 'Error adding this item' });
  }
};

/** PUT /api/auth/trips/:tripId/items/:itemId */
const updateItem = async (req, res) => {
  try {
    const item = await tripModel.updateItem(
      req.user.uid,
      Number(req.params.tripId),
      Number(req.params.itemId),
      req.body
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });

    res.status(200).json({ item });
  } catch (error) {
    logger.error({ err: error }, 'Error updating trip item');
    res.status(500).json({ message: 'Error updating this item' });
  }
};

/** DELETE /api/auth/trips/:tripId/items/:itemId */
const deleteItem = async (req, res) => {
  try {
    const removed = await tripModel.deleteItem(
      req.user.uid,
      Number(req.params.tripId),
      Number(req.params.itemId)
    );
    if (!removed) return res.status(404).json({ message: 'Item not found' });

    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting trip item');
    res.status(500).json({ message: 'Error deleting this item' });
  }
};

/**
 * PUT /api/auth/trips/:tripId/days/:dayId/items/order — the drag-and-drop write.
 *
 * Takes the full ordered id list. A rejected reorder is a 400 rather than a 404, because the caller
 * *did* find the day — it sent a list that does not describe it, which is a different mistake and a
 * different fix.
 */
const reorderItems = async (req, res) => {
  try {
    const ok = await tripModel.reorderItems(
      req.user.uid,
      Number(req.params.tripId),
      Number(req.params.dayId),
      req.body.item_ids
    );

    if (!ok) {
      return res.status(400).json({
        message: 'The order must list exactly the items in this day, once each'
      });
    }

    res.status(200).json({ reordered: true });
  } catch (error) {
    logger.error({ err: error }, 'Error reordering trip items');
    res.status(500).json({ message: 'Error reordering these items' });
  }
};

module.exports = {
  listTrips,
  getTrip,
  getTripFeasibility,
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
