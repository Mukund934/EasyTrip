import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import {
  FiSave, FiMapPin, FiTag, FiPlus, FiMinus, FiImage,
  FiArrowLeft, FiX, FiThermometer, FiSun, FiCloudRain,
  FiHeart, FiBook, FiClock, FiCpu, FiMap, FiUpload,
  FiAlertCircle, FiInfo, FiNavigation, FiEye, FiCheck,
  FiLoader, FiCamera, FiGlobe, FiHome, FiMapPin as FiLocation
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/ImageUpload';
import { createPlace } from '../../services/placeService';

// Enhanced theme options with icons and descriptions
const themeOptions = [
  { 
    id: 'hot', 
    label: 'Hot Weather', 
    icon: <FiSun className="mr-2" />, 
    description: 'Perfect for summer visits',
    color: 'orange'
  },
  { 
    id: 'cold', 
    label: 'Cold Weather', 
    icon: <FiThermometer className="mr-2" />, 
    description: 'Ideal for winter experiences',
    color: 'blue'
  },
  { 
    id: 'rainy', 
    label: 'Rainy Season', 
    icon: <FiCloudRain className="mr-2" />, 
    description: 'Beautiful during monsoons',
    color: 'gray'
  },
  { 
    id: 'romantic', 
    label: 'Romantic', 
    icon: <FiHeart className="mr-2" />, 
    description: 'Perfect for couples',
    color: 'pink'
  },
  { 
    id: 'religious', 
    label: 'Religious', 
    icon: <FiBook className="mr-2" />, 
    description: 'Spiritual destinations',
    color: 'purple'
  },
  { 
    id: 'historical', 
    label: 'Historical', 
    icon: <FiClock className="mr-2" />, 
    description: 'Rich in history',
    color: 'amber'
  },
  { 
    id: 'science', 
    label: 'Science', 
    icon: <FiCpu className="mr-2" />, 
    description: 'Educational and scientific',
    color: 'green'
  },
  { 
    id: 'tech', 
    label: 'Technology', 
    icon: <FiCpu className="mr-2" />, 
    description: 'Modern tech hubs',
    color: 'indigo'
  },
  { 
    id: 'adventure', 
    label: 'Adventure', 
    icon: <FiMap className="mr-2" />, 
    description: 'Thrilling activities',
    color: 'red'
  },
  { 
    id: 'nature', 
    label: 'Nature', 
    icon: <FiGlobe className="mr-2" />, 
    description: 'Natural beauty',
    color: 'green'
  },
  { 
    id: 'family', 
    label: 'Family Friendly', 
    icon: <FiHome className="mr-2" />, 
    description: 'Great for families',
    color: 'blue'
  },
  { 
    id: 'weekend', 
    label: 'Weekend Getaway', 
    icon: <FiClock className="mr-2" />, 
    description: 'Perfect for short trips',
    color: 'teal'
  }
];

// Common tag suggestions
const tagSuggestions = [
  'family-friendly', 'weekend', 'nature', 'photography', 'trekking', 
  'peaceful', 'crowded', 'budget-friendly', 'luxury', 'heritage',
  'beach', 'mountain', 'temple', 'museum', 'park', 'market',
  'shopping', 'food', 'nightlife', 'cultural', 'educational'
];

export default function AddPlace() {
  const router = useRouter();
  const { currentUser, loading, isAdmin } = useAuth();

  // Form state
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
    custom_keys: {}
  });

  // UI state
  const [primaryImage, setPrimaryImage] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!currentUser || !isAdmin)) {
      toast.error('Unauthorized access - Admin privileges required');
      router.push('/auth/login?redirect=/admin/addPlace');
    }
  }, [currentUser, loading, isAdmin, router]);

  // Enhanced form validation
  const validateForm = () => {
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
    } else if (formData.latitude && (parseFloat(formData.latitude) < -90 || parseFloat(formData.latitude) > 90)) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }
    
    if (formData.longitude && isNaN(parseFloat(formData.longitude))) {
      newErrors.longitude = 'Longitude must be a valid number';
    } else if (formData.longitude && (parseFloat(formData.longitude) < -180 || parseFloat(formData.longitude) > 180)) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }
    
    if (formData.pin_code && !/^\d{6}$/.test(formData.pin_code)) {
      newErrors.pin_code = 'PIN code must be exactly 6 digits';
    }
    
    if (formData.description && formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }
    
    // Image validation
    if (primaryImage && primaryImage.size > 5 * 1024 * 1024) {
      newErrors.image = 'Image size must be less than 5MB';
    }
    
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
        ? formData.themes.filter(id => id !== themeId)
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
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
      
      toast.success('Image uploaded successfully');
    }
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
      toast.success(`Tag "${tagToAdd}" added`);
    } else if (!tagToAdd) {
      toast.error('Tag cannot be empty');
    } else {
      toast.error('Tag already exists');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
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
      toast.success(`Detail "${key}" added`);
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

  // Enhanced form submission with better error handling
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    
    try {
      // Prepare data object for the service
      const placeData = {
        ...formData,
        // Add the image file directly
        image: primaryImage
      };
      
      console.log('Submitting place data:', {
        name: placeData.name,
        location: placeData.location,
        hasImage: !!placeData.image,
        themes: placeData.themes,
        tags: placeData.tags
      });
      
      // Submit the form - let the service handle FormData creation
      const response = await createPlace(placeData);
      
      setIsSubmitting(false);
      toast.success('Place created successfully!');
      router.push(`/places/${response.id}`);
      
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading admin panel...</p>
        </motion.div>
      </div>
    );
  }

  const stepTitles = {
    1: 'Basic Information',
    2: 'Location Details',
    3: 'Media & Themes',
    4: 'Tags & Details'
  };

  return (
    <>
      <Head>
        <title>Add New Place - EasyTrip Admin</title>
        <meta name="description" content="Add a new place to EasyTrip - Admin Panel" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4 group"
            >
              <FiArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Admin Dashboard
            </button>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Add New Place</h1>
            <p className="text-gray-600 text-lg">Create a new destination with detailed information</p>
          </motion.div>

          {/* Progress Indicator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                {Object.entries(stepTitles).map(([stepNum, title]) => (
                  <div key={stepNum} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      parseInt(stepNum) === step 
                        ? 'bg-blue-600 text-white' 
                        : parseInt(stepNum) < step 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                    }`}>
                      {parseInt(stepNum) < step ? <FiCheck className="w-4 h-4" /> : stepNum}
                    </div>
                    <span className={`ml-2 text-sm font-medium ${
                      parseInt(stepNum) === step ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {title}
                    </span>
                    {stepNum !== '4' && (
                      <div className={`w-12 h-1 mx-4 ${
                        parseInt(stepNum) < step ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit} 
            className="bg-white shadow-xl rounded-2xl overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {/* Step 1: Basic Information */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="p-8"
                >
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-blue-100 rounded-lg mr-4">
                      <FiInfo className="text-blue-600 h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                        Place Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`block w-full border-2 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4 ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter the place name"
                        required
                      />
                      {errors.name && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-red-500 flex items-center"
                        >
                          <FiAlertCircle className="mr-1" />
                          {errors.name}
                        </motion.p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="location" className="block text-sm font-semibold text-gray-700 mb-2">
                        Location *
                      </label>
                      <div className="relative">
                        <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          id="location"
                          name="location"
                          value={formData.location}
                          onChange={handleChange}
                          className={`block w-full pl-10 border-2 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4 ${
                            errors.location ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter the location"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleLocationLookup}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-700"
                          title="Auto-fill coordinates"
                        >
                          <FiNavigation className="w-4 h-4" />
                        </button>
                      </div>
                      {errors.location && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-red-500 flex items-center"
                        >
                          <FiAlertCircle className="mr-1" />
                          {errors.location}
                        </motion.p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="6"
                      className={`block w-full border-2 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4 ${
                        errors.description ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Describe this place, its attractions, and what makes it special..."
                    />
                    <div className="mt-1 flex justify-between text-sm text-gray-500">
                      <span>Optional but recommended</span>
                      <span>{formData.description.length}/2000</span>
                    </div>
                    {errors.description && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-500 flex items-center"
                      >
                        <FiAlertCircle className="mr-1" />
                        {errors.description}
                      </motion.p>
                    )}
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Next: Location Details
                      <FiArrowLeft className="ml-2 rotate-180" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Location Details */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="p-8"
                >
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-green-100 rounded-lg mr-4">
                      <FiLocation className="text-green-600 h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Location Details</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label htmlFor="district" className="block text-sm font-semibold text-gray-700 mb-2">
                        District
                      </label>
                      <input
                        type="text"
                        id="district"
                        name="district"
                        value={formData.district}
                        onChange={handleChange}
                        className="block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4"
                        placeholder="Enter district name"
                      />
                    </div>

                    <div>
                      <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4"
                        placeholder="Enter state name"
                      />
                    </div>

                    <div>
                      <label htmlFor="locality" className="block text-sm font-semibold text-gray-700 mb-2">
                        Locality
                      </label>
                      <input
                        type="text"
                        id="locality"
                        name="locality"
                        value={formData.locality}
                        onChange={handleChange}
                        className="block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4"
                        placeholder="Enter locality/area name"
                      />
                    </div>

                    <div>
                      <label htmlFor="pin_code" className="block text-sm font-semibold text-gray-700 mb-2">
                        PIN Code
                      </label>
                      <input
                        type="text"
                        id="pin_code"
                        name="pin_code"
                        value={formData.pin_code}
                        onChange={handleChange}
                        className={`block w-full border-2 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4 ${
                          errors.pin_code ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="123456"
                        maxLength="6"
                      />
                      {errors.pin_code && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-red-500 flex items-center"
                        >
                          <FiAlertCircle className="mr-1" />
                          {errors.pin_code}
                        </motion.p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-6">
                    <div>
                      <label htmlFor="latitude" className="block text-sm font-semibold text-gray-700 mb-2">
                        Latitude
                      </label>
                      <input
                        type="text"
                        id="latitude"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleChange}
                        placeholder="e.g. 28.6139"
                        className={`block w-full border-2 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4 ${
                          errors.latitude ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.latitude && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-red-500 flex items-center"
                        >
                          <FiAlertCircle className="mr-1" />
                          {errors.latitude}
                        </motion.p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="longitude" className="block text-sm font-semibold text-gray-700 mb-2">
                        Longitude
                      </label>
                      <input
                        type="text"
                        id="longitude"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleChange}
                        placeholder="e.g. 77.2090"
                        className={`block w-full border-2 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors py-3 px-4 ${
                          errors.longitude ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.longitude && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-red-500 flex items-center"
                        >
                          <FiAlertCircle className="mr-1" />
                          {errors.longitude}
                        </motion.p>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      <FiArrowLeft className="mr-2" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Next: Media & Themes
                      <FiArrowLeft className="ml-2 rotate-180" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Media & Themes */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="p-8"
                >
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-purple-100 rounded-lg mr-4">
                      <FiCamera className="text-purple-600 h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Media & Themes</h2>
                  </div>

                  {/* Primary Image Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Primary Image</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload a main image for this place (max 5MB). You can add more images after creating the place.
                    </p>
                    
                    <ImageUpload 
                      onImageSelect={(file) => {
                        if (file) {
                          handleImageChange(file);
                        } else {
                          setPrimaryImage(null);
                          setImagePreview(null);
                          toast.info('Image removed');
                        }
                      }}
                      maxSize={5 * 1024 * 1024} // 5MB
                      multiple={false}
                      preview={true}
                      className="w-full"
                    />
                    
                    {errors.image && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-500 flex items-center"
                      >
                        <FiAlertCircle className="mr-1" />
                        {errors.image}
                      </motion.p>
                    )}
                  </div>

                  {/* Themes Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Theme Categories</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Select all themes that apply to this destination
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {themeOptions.map(theme => (
                        <motion.div
                          key={theme.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <button
                            type="button"
                            onClick={() => handleThemeToggle(theme.id)}
                            className={`flex items-center p-4 rounded-xl w-full transition-all border-2 ${
                              formData.themes.includes(theme.id)
                                ? `bg-${theme.color}-50 text-${theme.color}-700 border-${theme.color}-300 shadow-md`
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {theme.icon}
                            </div>
                            <div className="text-left">
                              <div className="font-medium">{theme.label}</div>
                              <div className="text-xs opacity-75">{theme.description}</div>
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Selected: {formData.themes.length} theme{formData.themes.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      <FiArrowLeft className="mr-2" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Next: Tags & Details
                      <FiArrowLeft className="ml-2 rotate-180" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Tags & Details */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="p-8"
                >
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                      <FiTag className="text-yellow-600 h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Tags & Additional Details</h2>
                  </div>

                  {/* Tags Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Tags</h3>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {formData.tags.map((tag, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center bg-blue-50 text-blue-700 px-3 py-2 rounded-full border border-blue-200"
                        >
                          <span className="text-sm font-medium">{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-2 text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <div className="relative">
                      <div className="flex">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => {
                            setNewTag(e.target.value);
                            setShowTagSuggestions(e.target.value.length > 0);
                          }}
                          className="block w-full border-2 border-gray-300 rounded-l-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                          placeholder="Add a tag (e.g., family-friendly, weekend, nature)"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTag()}
                          className="inline-flex items-center px-6 py-3 border-2 border-l-0 border-blue-600 text-blue-600 font-medium rounded-r-xl hover:bg-blue-50 transition-colors"
                        >
                          <FiPlus className="mr-1" />
                          Add
                        </button>
                      </div>
                      
                      {/* Tag Suggestions */}
                      {showTagSuggestions && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        >
                          {tagSuggestions
                            .filter(suggestion => 
                              suggestion.toLowerCase().includes(newTag.toLowerCase()) &&
                              !formData.tags.includes(suggestion)
                            )
                            .slice(0, 8)
                            .map(suggestion => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => handleAddTag(suggestion)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 border-b border-gray-100 last:border-b-0"
                              >
                                {suggestion}
                              </button>
                            ))}
                        </motion.div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.tags.length}/10 tags • Click suggestions above or type your own
                    </p>
                  </div>

                  {/* Custom Details Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Details</h3>

                    <div className="space-y-3 mb-6">
                      {Object.entries(formData.custom_keys).map(([key, value], index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center bg-gray-50 p-4 rounded-xl border border-gray-200"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{key}</div>
                            <div className="text-gray-600 text-sm">{value}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomKey(key)}
                            className="text-red-500 hover:text-red-700 transition-colors p-2"
                          >
                            <FiMinus className="w-5 h-5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                        placeholder="Detail name (e.g., Best Time to Visit)"
                      />
                      <input
                        type="text"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                        placeholder="Detail value (e.g., October to March)"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomKey();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomKey}
                      className="mt-3 inline-flex items-center px-4 py-2 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <FiPlus className="mr-2" />
                      Add Detail
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      {Object.keys(formData.custom_keys).length}/10 custom details
                    </p>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      <FiArrowLeft className="mr-2" />
                      Previous
                    </button>
                    <div className="space-x-4">
                      <button
                        type="button"
                        onClick={() => router.push('/admin')}
                        className="inline-flex items-center px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center">
                            <FiLoader className="animate-spin mr-2 h-5 w-5" />
                            Creating Place...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <FiSave className="mr-2 h-5 w-5" />
                            Create Place
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          {/* Form Summary (when submitting) */}
          <AnimatePresence>
            {isSubmitting && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6"
              >
                <div className="flex items-center mb-4">
                  <FiLoader className="animate-spin h-5 w-5 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-blue-900">Creating Your Place...</h3>
                </div>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• Validating form data</p>
                  <p>• {primaryImage ? 'Uploading image to Firebase Storage' : 'Preparing place data'}</p>
                  <p>• Saving to database</p>
                  <p>• Setting up admin permissions</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}