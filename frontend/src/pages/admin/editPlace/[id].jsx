import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import { FiSave, FiPlus, FiMinus, FiArrowLeft, FiX } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import ImageUpload from '../../../components/ImageUpload';
import { getPlaceById, updatePlace } from '../../../services/placeService';

// Utility function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  } catch {
    return 'Invalid Date';
  }
};

export default function EditPlace() {
  const router = useRouter();
  const { id } = router.query;
  const { currentUser, loading, isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    district: '',
    state: '',
    locality: '',
    pin_code: '',
    latitude: '',
    longitude: '',
    themes: [],
    tags: [],
    custom_keys: {},
    created_by: '',
    created_by_name: '',
    updated_by: '',
    updated_by_name: '',
  });

  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [newTheme, setNewTheme] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPlace, setLoadingPlace] = useState(true);
  const [error, setError] = useState(null);
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [previousUpdate, setPreviousUpdate] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!currentUser || !isAdmin)) {
      toast.error('Access denied: Admin privileges required');
      router.push('/');
    }
  }, [currentUser, loading, isAdmin, router]);

  // Fetch place data
  useEffect(() => {
    const fetchPlace = async () => {
      if (!id) return;

      try {
        setLoadingPlace(true);
        setError(null);

        const data = await getPlaceById(id);

        console.log('Place data received:', {
          id: data.id,
          name: data.name,
          location: data.location,
          hasImage: !!data.image_url,
          tagsCount: data.tags?.length || 0,
          themesCount: data.themes?.length || 0,
          createdBy: data.created_by,
          createdByName: data.created_by_name,
          updatedBy: data.updated_by,
          updatedByName: data.updated_by_name,
        });

        setFormData({
          name: data.name || '',
          description: data.description || '',
          location: data.location || '',
          district: data.district || '',
          state: data.state || '',
          locality: data.locality || '',
          pin_code: data.pin_code || '',
          latitude: data.latitude || '',
          longitude: data.longitude || '',
          themes: data.themes || [],
          tags: data.tags || [],
          custom_keys: data.custom_keys || {},
          created_by: data.created_by || currentUser?.uid || '',
          created_by_name: data.created_by_name || currentUser?.displayName || currentUser?.email || 'Unknown User',
          updated_by: currentUser?.uid || '',
          updated_by_name: currentUser?.displayName || currentUser?.email || 'Unknown User',
        });

        setCurrentImageUrl(data.image_url);
        setCreatedAt(data.created_at || '');
        setUpdatedAt(data.updated_at || '');
        setPreviousUpdate(data.previous_update || '');
        setLoadingPlace(false);
      } catch (error) {
        console.error(`Error fetching place ID ${id}:`, {
          message: error.message,
          status: error.status,
        });
        setError(error.message || 'Place not found or could not be loaded');
        setLoadingPlace(false);
        toast.error(error.message || 'Failed to load place');
      }
    };

    if (id && currentUser && isAdmin) {
      fetchPlace();
    }
  }, [id, currentUser, isAdmin]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (file) => {
    setFormData({ ...formData, image: file });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleAddTheme = () => {
    if (newTheme.trim() && !formData.themes.includes(newTheme.trim())) {
      setFormData({ ...formData, themes: [...formData.themes, newTheme.trim()] });
      setNewTheme('');
    }
  };

  const handleRemoveTheme = (themeToRemove) => {
    setFormData({
      ...formData,
      themes: formData.themes.filter((theme) => theme !== themeToRemove),
    });
  };

  const handleAddCustomKey = () => {
    if (newKeyName.trim() && newKeyValue.trim()) {
      setFormData({
        ...formData,
        custom_keys: {
          ...formData.custom_keys,
          [newKeyName.trim()]: newKeyValue.trim(),
        },
      });
      setNewKeyName('');
      setNewKeyValue('');
    }
  };

  const handleRemoveCustomKey = (keyToRemove) => {
    const updatedCustomKeys = { ...formData.custom_keys };
    delete updatedCustomKeys[keyToRemove];
    setFormData({ ...formData, custom_keys: updatedCustomKeys });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name || !formData.location) {
      toast.error('Name and location are required');
      return;
    }

    // Additional validation
    if (formData.pin_code && !/^\d{6}$/.test(formData.pin_code)) {
      toast.error('PIN code must be 6 digits');
      return;
    }
    if (formData.latitude && isNaN(parseFloat(formData.latitude))) {
      toast.error('Latitude must be a valid number');
      return;
    }
    if (formData.longitude && isNaN(parseFloat(formData.longitude))) {
      toast.error('Longitude must be a valid number');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await currentUser.getIdToken();
      const updatedFormData = {
        ...formData,
        created_by: formData.created_by || currentUser.uid,
        created_by_name: formData.created_by_name || currentUser.displayName || currentUser.email || 'Unknown User',
        updated_by: currentUser.uid,
        updated_by_name: currentUser.displayName || currentUser.email || 'Unknown User',
        updated_at: new Date().toISOString(),
      };

      console.log('Update data:', {
        id,
        ...updatedFormData,
        hasImage: !!formData.image,
        customKeysCount: Object.keys(formData.custom_keys).length,
        tagsCount: formData.tags.length,
        themesCount: formData.themes.length,
      });

      await updatePlace(id, updatedFormData, token);

      toast.success('Place updated successfully!');
      router.push('/admin/managePlaces');
    } catch (error) {
      console.error('Error updating place:', {
        message: error.message,
        status: error.status,
        responseData: error.response?.data,
      });
      toast.error(error.message || 'Failed to update place');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || loadingPlace) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="relative w-24 h-24">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-primary-600 border-b-primary-300 border-l-primary-600 border-r-primary-300 rounded-full animate-spin"></div>
          <div className="absolute top-2 left-2 w-20 h-20 border-4 border-t-primary-400 border-b-primary-100 border-l-primary-400 border-r-primary-100 rounded-full animate-spin-slow"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-lg text-gray-700 mb-6">{error}</p>
        <button
          onClick={() => router.push('/admin/managePlaces')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
        >
          <FiArrowLeft className="mr-2" />
          Return to Manage Places
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit Place - EasyTrip Admin</title>
      </Head>

      <div className="bg-gray-50 min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <FiArrowLeft className="mr-2" />
              Back
            </button>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Edit Place: {formData.name}
            </h1>
            <div className="mt-2 text-sm text-gray-600">
              <p>Created: {formatDate(createdAt)}</p>
              <p>Created By: {formData.created_by_name}</p>
              <p>Last Updated: {formatDate(updatedAt)}</p>
              <p>Updated By: {formData.updated_by_name}</p>
              <p>Previous Update: {formatDate(previousUpdate)}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
            {/* Basic Information */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Basic Information
              </h2>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Place Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Location *
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="district"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    District
                  </label>
                  <input
                    type="text"
                    id="district"
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="locality"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Locality
                  </label>
                  <input
                    type="text"
                    id="locality"
                    name="locality"
                    value={formData.locality}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pin_code"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    PIN Code
                  </label>
                  <input
                    type="text"
                    id="pin_code"
                    name="pin_code"
                    value={formData.pin_code}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="latitude"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Latitude
                  </label>
                  <input
                    type="number"
                    id="latitude"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    step="any"
                  />
                </div>

                <div>
                  <label
                    htmlFor="longitude"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Longitude
                  </label>
                  <input
                    type="number"
                    id="longitude"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    step="any"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="4"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Place Image
              </h2>
              <ImageUpload
                onImageSelect={handleImageChange}
                currentImage={currentImageUrl}
                maxSize={5 * 1024 * 1024} // 5MB
                multiple={false}
                preview={true}
              />
            </div>

            {/* Themes */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Themes</h2>

              <div className="flex flex-wrap gap-2 mb-3">
                {formData.themes.map((theme, index) => (
                  <div
                    key={index}
                    className="flex items-center bg-primary-50 text-primary-700 px-3 py-1 rounded-full"
                  >
                    <span>{theme}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTheme(theme)}
                      className="ml-2 text-primary-500 hover:text-primary-700"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex">
                <input
                  type="text"
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  className="block w-full border-gray-300 rounded-l-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Add a theme (e.g., adventure, cultural, nature)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTheme();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTheme}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                >
                  <FiPlus className="mr-1" />
                  Add
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Tags</h2>

              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map((tag, index) => (
                  <div
                    key={index}
                    className="flex items-center bg-primary-50 text-primary-700 px-3 py-1 rounded-full"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 text-primary-500 hover:text-primary-700"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="block w-full border-gray-300 rounded-l-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Add a tag (e.g., beach, mountain, temple)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                >
                  <FiPlus className="mr-1" />
                  Add
                </button>
              </div>
            </div>

            {/* Custom Keys */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Additional Details
              </h2>

              <div className="space-y-3 mb-4">
                {Object.entries(formData.custom_keys).map(([key, value], index) => (
                  <div
                    key={index}
                    className="flex items-center bg-gray-50 p-3 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{key}</div>
                      <div className="text-gray-600">{value}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomKey(key)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiMinus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Key (e.g., Best Time to Visit)"
                />
                <input
                  type="text"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Value (e.g., October to March)"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomKey}
                className="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiPlus className="mr-1" />
                Add Detail
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <FiSave className="mr-2" />
                    Update Place
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="hidden">
        <pre>
          {JSON.stringify(
            {
              id,
              formData,
              currentImageUrl,
              createdAt,
              updatedAt,
              previousUpdate,
              user: currentUser?.uid || '',
              userName: currentUser?.displayName || currentUser?.email || 'Unknown User',
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )}
        </pre>
      </div>
    </>
  );
}