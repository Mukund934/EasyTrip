
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { FiEdit, FiTrash2, FiPlus, FiArrowLeft, FiSearch, FiFilter } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import ImageWithFallback from '../../components/ImageWithFallback';
import { getAllPlaces, deletePlace } from '../../services/placeService';

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
      <div className="flex justify-center items-center min-h-screen">
        <div className="relative w-24 h-24">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-primary-600 border-b-primary-300 border-l-primary-600 border-r-primary-300 rounded-full animate-spin"></div>
          <div className="absolute top-2 left-2 w-20 h-20 border-4 border-t-primary-400 border-b-primary-100 border-l-primary-400 border-r-primary-100 rounded-full animate-spin-slow"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Manage Places - EasyTrip Admin</title>
      </Head>

      <div className="bg-gray-50 min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4 sm:mb-0"
              >
                <FiArrowLeft className="mr-2" />
                Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Manage Places</h1>
            </div>

            <Link
              href="/admin/addPlace"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Add New Place
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-white shadow rounded-lg p-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-2">
                <label htmlFor="search" className="sr-only">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="search"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Search by name, description, location, or updated by"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="location" className="sr-only">
                  Filter by Location
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiFilter className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    id="location"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
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
              </div>
            </div>
          </div>

          {/* Places List */}
          {filteredPlaces.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">
                {places.length === 0
                  ? 'No places found. Add your first place!'
                  : 'No places match your filters.'}
              </p>
              {places.length === 0 && (
                <Link
                  href="/admin/addPlace"
                  className="inline-flex items-center px-4 py-2 mt-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                >
                  <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                  Add Place
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Place
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Last Updated
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Updated By
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPlaces.map((place) => (
                    <tr key={place.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-md overflow-hidden">
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
                        <Link
                          href={`/admin/editPlace/${place.id}`}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          <FiEdit className="inline h-5 w-5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                        <button
                          onClick={() => confirmDelete(place)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="inline h-5 w-5" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                        Are you sure you want to delete "{placeToDelete?.name}"? This
                        action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

      <div className="hidden">
        <pre>
          {JSON.stringify(
            {
              placesCount: places.length,
              filteredPlacesCount: filteredPlaces.length,
              locationsCount: locations.length,
              user: currentUser?.uid || '',
              userName: currentUser?.displayName || 'Unknown User',
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
