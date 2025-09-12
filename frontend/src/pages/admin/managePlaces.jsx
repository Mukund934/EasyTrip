import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { 
  FiEdit, 
  FiTrash2, 
  FiPlus, 
  FiArrowLeft, 
  FiSearch, 
  FiFilter, 
  FiMoreVertical,
  FiMapPin,
  FiClock,
  FiUser,
  FiEye
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import ImageWithFallback from '../../components/ImageWithFallback';
import { getAllPlaces, deletePlace } from '../../services/placeService';

// Utility function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Invalid Date';
  }
};

// Truncate text for mobile display
const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

export default function ManagePlaces() {
  const { currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [places, setPlaces] = useState([]);
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [placeToDelete, setPlaceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [showFilters, setShowFilters] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!currentUser || !isAdmin)) {
      toast.error('Access denied: Admin privileges required');
      router.push('/');
    }
  }, [currentUser, loading, isAdmin, router]);

  // Fetch places
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setLoadingPlaces(true);
        const data = await getAllPlaces();
        console.log('Places fetched:', {
          count: data.length,
          firstPlace: data[0] ? { id: data[0].id, name: data[0].name, updatedByName: data[0].updated_by_name } : null,
        });
        setPlaces(data);
        setFilteredPlaces(data);

        // Extract unique locations
        const uniqueLocations = [...new Set(data.map((place) => place.location).filter(Boolean))];
        setLocations(uniqueLocations);

        setLoadingPlaces(false);
      } catch (error) {
        console.error('Error fetching places:', {
          message: error.message,
          status: error.status,
        });
        toast.error(error.message || 'Failed to load places');
        setLoadingPlaces(false);
      }
    };

    if (!loading && currentUser && isAdmin) {
      fetchPlaces();
    }
  }, [loading, currentUser, isAdmin]);

  // Filter places based on search and location
  useEffect(() => {
    if (places.length > 0) {
      let filtered = [...places];

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (place) =>
            place.name.toLowerCase().includes(term) ||
            (place.description && place.description.toLowerCase().includes(term)) ||
            (place.location && place.location.toLowerCase().includes(term)) ||
            (place.updated_by_name && place.updated_by_name.toLowerCase().includes(term))
        );
      }

      if (selectedLocation) {
        filtered = filtered.filter((place) => place.location === selectedLocation);
      }

      setFilteredPlaces(filtered);
    }
  }, [searchTerm, selectedLocation, places]);

  const confirmDelete = (place) => {
    setPlaceToDelete(place);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!placeToDelete) return;

    try {
      setDeleting(true);
      const token = await currentUser.getIdToken();
      await deletePlace(placeToDelete.id, token);

      // Update state
      setPlaces(places.filter((p) => p.id !== placeToDelete.id));
      setFilteredPlaces(filteredPlaces.filter((p) => p.id !== placeToDelete.id));

      toast.success('Place deleted successfully');
      setShowDeleteModal(false);
      setPlaceToDelete(null);
    } catch (error) {
      console.error('Error deleting place:', {
        message: error.message,
        status: error.status,
        placeId: placeToDelete.id,
      });
      toast.error(error.message || 'Failed to delete place');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || (loadingPlaces && isAdmin)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="relative w-16 h-16 sm:w-24 sm:h-24">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-600 border-b-blue-300 border-l-blue-600 border-r-blue-300 rounded-full animate-spin"></div>
          <div className="absolute top-1 left-1 sm:top-2 sm:left-2 w-14 h-14 sm:w-20 sm:h-20 border-4 border-t-blue-400 border-b-blue-100 border-l-blue-400 border-r-blue-100 rounded-full animate-spin-slow"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Manage Places - EasyTrip Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="bg-gray-50 min-h-screen pt-16 sm:pt-24 pb-6 sm:pb-12 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
            <div className="flex-1">
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base"
              >
                <FiArrowLeft className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                Back to Dashboard
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Places</h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredPlaces.length} of {places.length} places
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              {/* View Toggle for larger screens */}
              <div className="hidden sm:flex bg-white rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'card'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Table
                </button>
              </div>

              <Link
                href="/admin/addPlace"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <FiPlus className="mr-2 h-4 w-4" />
                Add Place
              </Link>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 mb-6 overflow-hidden">
            <div className="p-4 sm:p-6">
              {/* Search Bar */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="Search places..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filter Toggle for Mobile */}
              <div className="flex items-center justify-between sm:hidden mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center text-gray-600 hover:text-gray-900 text-sm"
                >
                  <FiFilter className="mr-2 h-4 w-4" />
                  Filters
                </button>
                {selectedLocation && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {selectedLocation}
                  </span>
                )}
              </div>

              {/* Filters */}
              <div className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Location
                    </label>
                    <select
                      id="location"
                      className="block w-full border border-gray-300 rounded-lg py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                    >
                      <option value="">All Locations</option>
                      {locations.map((location, index) => (
                        <option key={index} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear Filters */}
                  {(searchTerm || selectedLocation) && (
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedLocation('');
                          setShowFilters(false);
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Places List */}
          {filteredPlaces.length === 0 ? (
            <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-8 text-center">
              <div className="max-w-md mx-auto">
                <FiMapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {places.length === 0 ? 'No places yet' : 'No matching places'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {places.length === 0
                    ? 'Get started by adding your first place to the platform.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
                {places.length === 0 && (
                  <Link
                    href="/admin/addPlace"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                  >
                    <FiPlus className="mr-2 h-4 w-4" />
                    Add First Place
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card View (default for mobile) */}
              <div className="block sm:hidden space-y-4">
                {filteredPlaces.map((place) => (
                  <div key={place.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex p-4">
                      {/* Place Image */}
                      <div className="flex-shrink-0 mr-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                          <ImageWithFallback
                            src={place.image_url}
                            alt={place.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            fallbackSrc="/images/placeholder.jpg"
                          />
                        </div>
                      </div>

                      {/* Place Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {place.name}
                            </h3>
                            <div className="flex items-center text-sm text-gray-500 mt-1">
                              <FiMapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                              <span className="truncate">{place.location}</span>
                            </div>
                          </div>

                          {/* Action Menu */}
                          <div className="ml-2 flex-shrink-0">
                            <div className="flex items-center space-x-2">
                              <Link
                                href={`/places/${place.id}`}
                                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                title="View Place"
                              >
                                <FiEye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/admin/editPlace/${place.id}`}
                                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                title="Edit Place"
                              >
                                <FiEdit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => confirmDelete(place)}
                                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                title="Delete Place"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        {place.tags && place.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {place.tags.slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                              >
                                {tag}
                              </span>
                            ))}
                            {place.tags.length > 2 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                +{place.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                          <div className="flex items-center">
                            <FiUser className="w-3 h-3 mr-1" />
                            <span className="truncate max-w-20">
                              {place.updated_by_name || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <FiClock className="w-3 h-3 mr-1" />
                            <span>{formatDate(place.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View - Card or Table based on viewMode */}
              <div className="hidden sm:block">
                {viewMode === 'card' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlaces.map((place) => (
                      <div key={place.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                        {/* Card Image */}
                        <div className="aspect-video bg-gray-100">
                          <ImageWithFallback
                            src={place.image_url}
                            alt={place.name}
                            width={400}
                            height={225}
                            className="w-full h-full object-cover"
                            fallbackSrc="/images/placeholder.jpg"
                          />
                        </div>

                        {/* Card Content */}
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 truncate flex-1">
                              {place.name}
                            </h3>
                            <div className="ml-2 flex items-center space-x-2">
                              <Link
                                href={`/places/${place.id}`}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                title="View Place"
                              >
                                <FiEye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/admin/editPlace/${place.id}`}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                title="Edit Place"
                              >
                                <FiEdit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => confirmDelete(place)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                                title="Delete Place"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center text-sm text-gray-500 mb-3">
                            <FiMapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                            <span className="truncate">{place.location}</span>
                          </div>

                          {place.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                              {truncateText(place.description, 120)}
                            </p>
                          )}

                          {/* Tags */}
                          {place.tags && place.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-4">
                              {place.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                                >
                                  {tag}
                                </span>
                              ))}
                              {place.tags.length > 3 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  +{place.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Meta Info */}
                          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                            <div className="flex items-center">
                              <FiUser className="w-3 h-3 mr-1" />
                              <span className="truncate">
                                {place.updated_by_name || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <FiClock className="w-3 h-3 mr-1" />
                              <span>{formatDate(place.updated_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Table View */
                  <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Place
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Location
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Updated
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Updated By
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredPlaces.map((place) => (
                            <tr key={place.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 rounded-lg overflow-hidden">
                                    <ImageWithFallback
                                      src={place.image_url}
                                      alt={place.name}
                                      width={40}
                                      height={40}
                                      className="h-10 w-10 object-cover"
                                      fallbackSrc="/images/placeholder.jpg"
                                    />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {place.name}
                                    </div>
                                    {place.tags && place.tags.length > 0 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {place.tags.slice(0, 3).join(', ')}
                                        {place.tags.length > 3 && '...'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{place.location}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(place.updated_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {place.updated_by_name || 'Unknown User'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-2">
                                  <Link
                                    href={`/places/${place.id}`}
                                    className="text-gray-600 hover:text-blue-600 p-1 rounded transition-colors"
                                    title="View Place"
                                  >
                                    <FiEye className="h-4 w-4" />
                                  </Link>
                                  <Link
                                    href={`/admin/editPlace/${place.id}`}
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                                    title="Edit Place"
                                  >
                                    <FiEdit className="h-4 w-4" />
                                  </Link>
                                  <button
                                    onClick={() => confirmDelete(place)}
                                    className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                                    title="Delete Place"
                                  >
                                    <FiTrash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-900 opacity-50"></div>
            </div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full mx-4">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FiTrash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Place
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete <span className="font-medium">"{placeToDelete?.name}"</span>? This
                        action cannot be undone and will permanently remove all associated data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    'Delete Place'
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
