/**
 * The place form's validation rules, as plain functions of their arguments (IMP-070).
 *
 * These were closures over `formData`, `primaryImage` and `setErrors` inside `addPlace.jsx`, so
 * every rule below — the coordinate ranges, the PIN format, the 5 MB image ceiling — could only be
 * exercised by mounting a 1,195-line wizard and typing into it. They are the same rules; the only
 * change is that they now take their inputs instead of closing over them.
 */

/**
 * Which fields belong to which wizard step.
 *
 * Keeping this beside the validator means a new required field is one entry away from being
 * enforced at the right step, rather than silently deferring to submit.
 */
export const STEP_FIELDS = {
  1: ['name', 'location', 'description'],
  2: ['district', 'state', 'locality', 'pin_code', 'latitude', 'longitude'],
  3: [],
  4: ['image']
};

/**
 * Every validation message the form would produce, keyed by field.
 *
 * @param {Object} formData
 * @param {File|null} primaryImage
 * @returns {Object} field -> message; empty when the form is valid
 */
export const collectErrors = (formData, primaryImage) => {
  const newErrors = {};

  // Required fields
  if (!formData.name.trim()) {
    newErrors.name = 'Place name is required';
  } else if (formData.name.length < 2) {
    newErrors.name = 'Place name must be at least 2 characters';
  } else if (formData.name.length > 100) {
    newErrors.name = 'Place name must be less than 100 characters';
  }

  if (!formData.location.trim()) {
    newErrors.location = 'Location is required';
  } else if (formData.location.length < 2) {
    newErrors.location = 'Location must be at least 2 characters';
  }

  // Optional but validated fields
  if (formData.latitude && isNaN(parseFloat(formData.latitude))) {
    newErrors.latitude = 'Latitude must be a valid number';
  } else if (
    formData.latitude &&
    (parseFloat(formData.latitude) < -90 || parseFloat(formData.latitude) > 90)
  ) {
    newErrors.latitude = 'Latitude must be between -90 and 90';
  }

  if (formData.longitude && isNaN(parseFloat(formData.longitude))) {
    newErrors.longitude = 'Longitude must be a valid number';
  } else if (
    formData.longitude &&
    (parseFloat(formData.longitude) < -180 || parseFloat(formData.longitude) > 180)
  ) {
    newErrors.longitude = 'Longitude must be between -180 and 180';
  }

  if (formData.pin_code && !/^\d{6}$/.test(formData.pin_code)) {
    newErrors.pin_code = 'PIN code must be exactly 6 digits';
  }

  // 5000, not 2000, and the number matters. The API's `placeBodyRules` allows 5000
  // (`optionalText('description', 'Description', 5000)`); the create form alone said 2000, so it
  // refused input the server would have accepted. Once the edit form started sharing these rules
  // (Sprint 5.12) that disagreement became worse than cosmetic: any existing place with a
  // description over 2000 characters would have been impossible to save from the edit form at all.
  // The server is the contract; the client now agrees with it.
  if (formData.description && formData.description.length > 5000) {
    newErrors.description = 'Description must be less than 5000 characters';
  }

  // Image validation
  if (primaryImage && primaryImage.size > 5 * 1024 * 1024) {
    newErrors.image = 'Image size must be less than 5MB';
  }

  return newErrors;
};

/**
 * Only the messages belonging to one step.
 *
 * Runs the full validator and filters, rather than keeping a second set of rules that could
 * disagree with the one at submit.
 */
export const collectStepErrors = (stepNumber, formData, primaryImage) => {
  const allErrors = collectErrors(formData, primaryImage);
  const stepErrors = {};
  for (const field of STEP_FIELDS[stepNumber] || []) {
    if (allErrors[field]) stepErrors[field] = allErrors[field];
  }
  return stepErrors;
};

/** The empty form. A function, so no two mounts can share one `themes`/`tags` array. */
export const emptyPlaceForm = () => ({
  name: '',
  description: '',
  location: '',
  district: '',
  state: '',
  locality: '',
  pin_code: '',
  latitude: '',
  longitude: '',
  // Which geocoder filled the coordinates, when one did (IMP-127). `null` — not `''` — because
  // `buildPlaceFormData` drops null and undefined, so an untouched form sends no claim at all
  // rather than an empty string the API would have to interpret.
  coordinates_source: null,
  themes: [],
  tags: [],
  custom_keys: {}
});
