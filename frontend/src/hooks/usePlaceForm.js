import { useState } from 'react';
import { toast } from 'react-toastify';
import { collectErrors, collectStepErrors, emptyPlaceForm } from '../utils/placeFormValidation';

/**
 * The add-place wizard's state and every operation on it (IMP-070).
 *
 * Returns one bundle rather than twenty values, because each step component destructures the
 * handful it needs — which keeps the step JSX identical to what it was inline in the page.
 *
 * @param {Object} deps - `{ getIdToken, createPlace, onCreated }`; injected so the submit path is
 *   callable without a router or a Firebase session.
 */
export function usePlaceForm({ getIdToken, createPlace, onCreated }) {
  const [formData, setFormData] = useState(emptyPlaceForm);

  // UI state
  const [primaryImage, setPrimaryImage] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const validateStep = (stepNumber) => {
    const stepErrors = collectStepErrors(stepNumber, formData, primaryImage);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const goToStep = (target) => {
    // Going backwards never blocks — a user must always be able to return and fix something.
    if (target < step) {
      setErrors({});
      setStep(target);
      return;
    }
    if (validateStep(step)) {
      setStep(target);
    }
  };

  const validateForm = () => {
    const newErrors = collectErrors(formData, primaryImage);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleThemeToggle = (themeId) => {
    setFormData({
      ...formData,
      themes: formData.themes.includes(themeId)
        ? formData.themes.filter((id) => id !== themeId)
        : [...formData.themes, themeId]
    });
  };

  const handleImageChange = (file) => {
    if (file) {
      // Validate file size
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        setErrors({ ...errors, image: 'Image size must be less than 5MB' });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed');
        setErrors({ ...errors, image: 'Only image files are allowed' });
        return;
      }

      setPrimaryImage(file);
      setErrors({ ...errors, image: '' });

      // Create preview
      const reader = new FileReader();
      reader.readAsDataURL(file);
    }
  };

  /**
   * Clearing the chosen image.
   *
   * Inline in the page this was `setPrimaryImage(null)` plus a toast, written directly into
   * `ImageUpload`'s callback — the one place the markup reached into the page's state rather than
   * calling a handler. Extracting the step surfaced it; it is the counterpart to
   * `handleImageChange` and belongs beside it.
   */
  const handleImageRemove = () => {
    setPrimaryImage(null);
    toast.info('Image removed');
  };

  const handleAddTag = (tag = null) => {
    const tagToAdd = tag || newTag.trim();
    if (tagToAdd && !formData.tags.includes(tagToAdd)) {
      if (formData.tags.length >= 10) {
        toast.error('Maximum 10 tags allowed');
        return;
      }
      setFormData({ ...formData, tags: [...formData.tags, tagToAdd] });
      setNewTag('');
      setShowTagSuggestions(false);
    } else if (!tagToAdd) {
      toast.error('Tag cannot be empty');
    } else {
      toast.error('Tag already exists');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove)
    });
    toast.info(`Tag "${tagToRemove}" removed`);
  };

  const handleAddCustomKey = () => {
    const key = newKeyName.trim();
    const value = newKeyValue.trim();

    if (key && value) {
      if (formData.custom_keys[key]) {
        toast.error('This detail key already exists');
        return;
      }

      if (Object.keys(formData.custom_keys).length >= 10) {
        toast.error('Maximum 10 custom details allowed');
        return;
      }

      setFormData({
        ...formData,
        custom_keys: {
          ...formData.custom_keys,
          [key]: value
        }
      });
      setNewKeyName('');
      setNewKeyValue('');
    } else {
      toast.error('Both key and value are required');
    }
  };

  const handleRemoveCustomKey = (keyToRemove) => {
    const updatedCustomKeys = { ...formData.custom_keys };
    delete updatedCustomKeys[keyToRemove];
    setFormData({ ...formData, custom_keys: updatedCustomKeys });
    toast.info(`Detail "${keyToRemove}" removed`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      // Prepare data object for the service
      const placeData = {
        ...formData,
        // Add the image file directly
        image: primaryImage
      };

      // Submit the form - let the service handle FormData creation
      const response = await createPlace(placeData, token);

      setIsSubmitting(false);
      toast.success('Place created successfully!');
      onCreated(response);
    } catch (error) {
      setIsSubmitting(false);
      console.error('Error creating place:', error);
      toast.error(error.message || 'Failed to create place. Please try again.');
    }
  };

  // Auto-fill coordinates based on location (mock implementation)
  const handleLocationLookup = async () => {
    if (!formData.location.trim()) {
      toast.error('Please enter a location first');
      return;
    }

    toast.info('🔍 Location lookup feature coming soon!');
    // TODO: Implement geocoding API integration
  };

  return {
    formData,
    errors,
    step,
    primaryImage,
    newTag,
    newKeyName,
    newKeyValue,
    isSubmitting,
    showTagSuggestions,
    setNewTag,
    setNewKeyName,
    setNewKeyValue,
    setShowTagSuggestions,
    handleChange,
    handleThemeToggle,
    handleImageChange,
    handleImageRemove,
    handleAddTag,
    handleRemoveTag,
    handleAddCustomKey,
    handleRemoveCustomKey,
    handleLocationLookup,
    handleSubmit,
    goToStep
  };
}
