import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { createRoot } from 'react-dom/client';
import {
  FiMapPin, FiStar, FiNavigation, FiLayers, FiPlus, FiMinus,
  FiMaximize2, FiMinimize2, FiFilter, FiX, FiSearch, FiRefreshCw,
  FiCrosshair, FiChevronRight, FiChevronLeft, FiInfo, FiAlertCircle,
  FiSettings, FiCompass, FiArrowRight, FiEye, FiGlobe, FiTarget,
  FiCheck, FiSun, FiMoon
} from 'react-icons/fi';

// Leaflet icon setup
const createCustomIcon = (className, selected = false) => {
  return L.divIcon({
    className: `custom-marker-icon ${selected ? 'selected' : ''}`,
    html: `<div class="marker-pin ${selected ? 'selected' : ''}">
             <div class="marker-icon">
               <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                 <circle cx="12" cy="10" r="3"></circle>
               </svg>
             </div>
             ${selected ? '<div class="marker-pulse"></div>' : ''}
           </div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
  });
};

// Rating icon
const createRatingIcon = (rating, selected = false) => {
  return L.divIcon({
    className: `rating-marker-icon ${selected ? 'selected' : ''}`,
    html: `<div class="marker-pin ${selected ? 'selected' : ''}">
             <div class="rating">
               <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="#FFD700" stroke-linecap="round" stroke-linejoin="round">
                 <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
               </svg>
               <span>${rating}</span>
             </div>
             ${selected ? '<div class="marker-pulse"></div>' : ''}
           </div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
  });
};

// Custom popup content
const createPopupContent = (place) => {
  const hasRating = place.rating_count && place.rating_sum;
  const rating = hasRating ? (place.rating_sum / place.rating_count).toFixed(1) : null;
  
  return `
    <div class="custom-popup">
      <div class="popup-header">
        <h3>${place.name}</h3>
        ${rating ? `
          <div class="rating">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="#FFD700" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>${rating}</span>
          </div>
        ` : ''}
      </div>
      <div class="popup-body">
        <p>${place.location}${place.district ? `, ${place.district}` : ''}${place.state ? `, ${place.state}` : ''}</p>
        ${place.description ? `<p class="description">${place.description.substring(0, 100)}${place.description.length > 100 ? '...' : ''}</p>` : ''}
      </div>
      <div class="popup-footer">
        <a href="/places/${place.id}" class="view-button">View Details</a>
      </div>
    </div>
  `;
};

// Utility function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

// Main ExploreMap component
const ExploreMap = ({ 
  places = [], 
  selectedPlace,
  onSelectPlace,
  center = { lat: 20.5937, lng: 78.9629 }, // Default to India's center
  zoom = 5,
  onZoomChange,
  onCenterChange,
  className = '',
}) => {
  // Refs for DOM elements
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const clusterLayerRef = useRef(null);
  const selectedMarkerRef = useRef(null);
  
  // State for UI and functionality
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [tileLayer, setTileLayer] = useState('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [clusterMode, setClusterMode] = useState(true);
  const [visiblePlaces, setVisiblePlaces] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [radiusMode, setRadiusMode] = useState(true);
  const RADIUS_KM = 300; // 300km radius
  const [mapMetrics, setMapMetrics] = useState({
    zoom: zoom,
    bearing: 0,
    pitch: 0,
    currentTime: '2025-09-05 23:19:33'
  });
  const [hoveredPlace, setHoveredPlace] = useState(null);
  
  // Map style options
  const TILE_LAYERS = [
    { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', icon: <FiMapPin /> },
    { id: 'terrain', name: 'Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', icon: <FiGlobe /> },
    { id: 'humanitarian', name: 'Humanitarian', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', icon: <FiCompass className="text-green-500" /> },
    { id: 'cycle', name: 'Cycle Map', url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', icon: <FiNavigation className="text-blue-500" /> },
    { id: 'watercolor', name: 'Watercolor', url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', icon: <FiSun className="text-yellow-500" /> },
    { id: 'dark', name: 'Dark Matter', url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', icon: <FiMoon className="text-indigo-500" /> }
  ];
  
  // Get user location and filter nearby places
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setUserLocation({ lat: userLat, lng: userLng });
          
          // Filter places within 300km radius
          const validPlaces = places.filter(place => 
            typeof place.latitude === 'number' && typeof place.longitude === 'number'
          );
          
          const placesWithDistance = validPlaces.map(place => ({
            ...place,
            distance: calculateDistance(userLat, userLng, place.latitude, place.longitude)
          }));
          
          const placesWithin300km = placesWithDistance.filter(place => place.distance <= RADIUS_KM);
          
          if (placesWithin300km.length > 0) {
            setNearbyPlaces(placesWithin300km.sort((a, b) => a.distance - b.distance));
          } else {
            // If no places within 300km, show all places but maintain radius mode
            setNearbyPlaces(placesWithDistance.sort((a, b) => a.distance - b.distance));
          }
        },
        (error) => {
          console.log('Geolocation error:', error);
          // If geolocation fails, use all places
          const validPlaces = places.filter(place => 
            typeof place.latitude === 'number' && typeof place.longitude === 'number'
          );
          setNearbyPlaces(validPlaces);
          setRadiusMode(false);
        }
      );
    } else {
      // Geolocation not supported, use all places
      const validPlaces = places.filter(place => 
        typeof place.latitude === 'number' && typeof place.longitude === 'number'
      );
      setNearbyPlaces(validPlaces);
      setRadiusMode(false);
    }
  }, [places]);

  // Filter places based on search query and nearby places
  const filteredPlaces = useMemo(() => {
    const placesToFilter = radiusMode ? nearbyPlaces : places.filter(place => 
      typeof place.latitude === 'number' && typeof place.longitude === 'number'
    );
    
    if (!searchQuery) return placesToFilter;
    
    const query = searchQuery.toLowerCase();
    return placesToFilter.filter(place => 
      place.name.toLowerCase().includes(query) ||
      place.location?.toLowerCase().includes(query) ||
      place.district?.toLowerCase().includes(query) ||
      place.state?.toLowerCase().includes(query)
    );
  }, [nearbyPlaces, places, searchQuery, radiusMode]);
  
  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    
    try {
      // Initialize Leaflet map with user location or default center
      const initialCenter = userLocation ? [userLocation.lat, userLocation.lng] : [center.lat, center.lng];
      const initialZoom = userLocation ? 10 : zoom; // Closer zoom if user location available
      
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 6, // Prevent zooming out too much
        maxZoom: 18,
        zoomControl: false, // We'll add custom zoom controls
        attributionControl: false // We'll add custom attribution
      });
      
      // Add tile layer
      L.tileLayer(tileLayer, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      
      // Add user location marker if available
      if (userLocation) {
        const userIcon = L.divIcon({
          className: 'user-location-icon',
          html: `<div class="user-marker">
                   <div class="user-marker-inner">
                     <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                       <circle cx="12" cy="7" r="4"></circle>
                     </svg>
                   </div>
                   <div class="user-marker-pulse"></div>
                 </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .bindPopup('Your Location')
          .addTo(map);
          
        // Add 300km radius circle if in radius mode
        if (radiusMode && nearbyPlaces.length > 0) {
          L.circle([userLocation.lat, userLocation.lng], {
            color: '#4F46E5',
            fillColor: '#4F46E5',
            fillOpacity: 0.1,
            radius: RADIUS_KM * 1000 // Convert to meters
          }).addTo(map);
        }
      }
      
      // Add custom zoom control
      L.control.zoom({
        position: 'bottomright'
      }).addTo(map);
      
      // Add scale control
      L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false
      }).addTo(map);
      
      // Add custom attribution
      const attribution = L.control.attribution({
        position: 'bottomright',
        prefix: 'AdminX | 2025-09-05 23:19:33'
      }).addTo(map);
      
      // Initialize marker layers
      const markersLayer = L.layerGroup().addTo(map);
      const clusterLayer = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 16,
        maxClusterRadius: 50,
        iconCreateFunction: function(cluster) {
          const count = cluster.getChildCount();
          let size = 'small';
          
          if (count > 50) size = 'large';
          else if (count > 20) size = 'medium';
          
          return L.divIcon({
            html: `<div class="cluster-marker ${size}"><span>${count}</span></div>`,
            className: 'leaflet-marker-cluster',
            iconSize: L.point(40, 40)
          });
        }
      });
      
      // Save references
      mapRef.current = map;
      markersLayerRef.current = markersLayer;
      clusterLayerRef.current = clusterLayer;
      
      // Set up event listeners
      map.on('load', () => {
        setMapLoaded(true);
        updateMarkers(filteredPlaces, selectedPlace);
      });
      
      map.on('moveend', () => {
        if (onCenterChange) {
          const center = map.getCenter();
          onCenterChange({ lat: center.lat, lng: center.lng });
        }
        
        // Get visible bounds - only use valid coordinates
        const bounds = map.getBounds();
        const visiblePlacesList = filteredPlaces.filter(place => {
          if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return false;
          return bounds.contains([place.latitude, place.longitude]);
        });
        
        setVisiblePlaces(visiblePlacesList);
      });
      
      map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        // Prevent zooming out too much
        if (currentZoom < 6) {
          map.setZoom(6);
          return;
        }
        
        if (onZoomChange) {
          onZoomChange(currentZoom);
        }
        
        setMapMetrics(prev => ({
          ...prev,
          zoom: currentZoom
        }));
      });
      
      // Initial render of markers
      updateMarkers(filteredPlaces, selectedPlace);
      
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Could not initialize map. Please check your internet connection.');
    }
  }, [userLocation, radiusMode, nearbyPlaces]);
  
  // Update markers when places or selected place changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      updateMarkers(filteredPlaces, selectedPlace);
    }
  }, [filteredPlaces, selectedPlace, mapLoaded, clusterMode]);
  
  // Update tile layer when it changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    // Remove existing tile layers
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        mapRef.current.removeLayer(layer);
      }
    });
    
    // Add new tile layer
    L.tileLayer(tileLayer, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapRef.current);
  }, [tileLayer, mapLoaded]);
  
  // Fly to selected place when it changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedPlace || !selectedPlace.latitude || !selectedPlace.longitude) return;
    
    try {
      // Fly to the selected place
      mapRef.current.flyTo(
        [selectedPlace.latitude, selectedPlace.longitude],
        Math.max(mapRef.current.getZoom(), 14),
        {
          animate: true,
          duration: 1.5
        }
      );
      
      // Update the selected marker
      updateSelectedMarker(selectedPlace);
    } catch (err) {
      console.error('Error flying to selected place:', err);
    }
  }, [selectedPlace, mapLoaded]);
  
  // Function to update markers on the map
  const updateMarkers = useCallback((places, selected) => {
    if (!mapRef.current || !markersLayerRef.current || !clusterLayerRef.current) return;
    
    try {
      // Clear existing markers
      markersLayerRef.current.clearLayers();
      clusterLayerRef.current.clearLayers();
      
      if (selectedMarkerRef.current) {
        mapRef.current.removeLayer(selectedMarkerRef.current);
        selectedMarkerRef.current = null;
      }
      
      // Remove and re-add cluster layer if using clustering
      if (clusterMode) {
        if (mapRef.current.hasLayer(markersLayerRef.current)) {
          mapRef.current.removeLayer(markersLayerRef.current);
        }
        if (!mapRef.current.hasLayer(clusterLayerRef.current)) {
          mapRef.current.addLayer(clusterLayerRef.current);
        }
      } else {
        if (mapRef.current.hasLayer(clusterLayerRef.current)) {
          mapRef.current.removeLayer(clusterLayerRef.current);
        }
        if (!mapRef.current.hasLayer(markersLayerRef.current)) {
          mapRef.current.addLayer(markersLayerRef.current);
        }
      }
      
      // Add markers for each place
      places.forEach(place => {
        if (!place.latitude || !place.longitude) return;
        
        const isSelected = selected && selected.id === place.id;
        const hasRating = place.rating_count && place.rating_sum;
        const rating = hasRating ? (place.rating_sum / place.rating_count).toFixed(1) : null;
        
        // Create marker
        const icon = rating 
          ? createRatingIcon(rating, isSelected)
          : createCustomIcon('marker', isSelected);
        
        const marker = L.marker([place.latitude, place.longitude], { 
          icon: icon,
          zIndexOffset: isSelected ? 1000 : 0
        });
        
        // Add popup
        marker.bindPopup(createPopupContent(place), {
          className: 'custom-popup-container',
          closeButton: true,
          autoClose: false,
          closeOnEscapeKey: true
        });
        
        // Add event listeners
        marker.on('click', () => {
          onSelectPlace(place);
        });
        
        // Show label on hover
        marker.on('mouseover', () => {
          marker.bindTooltip(place.name, {
            permanent: false,
            direction: 'top',
            className: 'custom-tooltip'
          }).openTooltip();
        });
        
        // Add to appropriate layer
        if (isSelected) {
          // Handle selected marker separately
          if (selectedMarkerRef.current) {
            mapRef.current.removeLayer(selectedMarkerRef.current);
          }
          marker.addTo(mapRef.current);
          selectedMarkerRef.current = marker;
        } else {
          if (clusterMode) {
            clusterLayerRef.current.addLayer(marker);
          } else {
            markersLayerRef.current.addLayer(marker);
          }
        }
      });
    } catch (err) {
      console.error('Error updating markers:', err);
    }
  }, [clusterMode, onSelectPlace]);
  
  // Function to update the selected marker
  const updateSelectedMarker = useCallback((place) => {
    if (!mapRef.current || !place || !place.latitude || !place.longitude) return;
    
    try {
      // Remove existing selected marker
      if (selectedMarkerRef.current) {
        mapRef.current.removeLayer(selectedMarkerRef.current);
      }
      
      // Create new selected marker
      const hasRating = place.rating_count && place.rating_sum;
      const rating = hasRating ? (place.rating_sum / place.rating_count).toFixed(1) : null;
      
      const icon = rating
        ? createRatingIcon(rating, true)
        : createCustomIcon('marker', true);
      
      const marker = L.marker([place.latitude, place.longitude], {
        icon: icon,
        zIndexOffset: 1000
      });
      
      // Add popup
      marker.bindPopup(createPopupContent(place), {
        className: 'custom-popup-container',
        closeButton: true,
        autoClose: false,
        closeOnEscapeKey: true
      });
      
      // Open popup
      marker.addTo(mapRef.current);
      marker.openPopup();
      
      // Save reference
      selectedMarkerRef.current = marker;
    } catch (err) {
      console.error('Error updating selected marker:', err);
    }
  }, []);
  
  // Function to toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!mapContainerRef.current) return;
    
    try {
      if (!isFullscreen) {
        if (mapContainerRef.current.requestFullscreen) {
          mapContainerRef.current.requestFullscreen();
        } else if (mapContainerRef.current.mozRequestFullScreen) {
          mapContainerRef.current.mozRequestFullScreen();
        } else if (mapContainerRef.current.webkitRequestFullscreen) {
          mapContainerRef.current.webkitRequestFullscreen();
        } else if (mapContainerRef.current.msRequestFullscreen) {
          mapContainerRef.current.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
      
      // Update state
      setIsFullscreen(!isFullscreen);
      
      // Resize map after toggling fullscreen
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, [isFullscreen]);
  
  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isInFullscreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      
      setIsFullscreen(isInFullscreen);
      
      // Resize map when fullscreen state changes
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Handle map errors and loading
  if (error) {
    return (
      <div className={`map-error-container ${className}`}>
        <div className="map-error">
          <FiAlertCircle className="error-icon" />
          <h3>Map Error</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            <FiRefreshCw className="refresh-icon" />
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Render the map and its controls
  return (
    <div className={`map-wrapper ${className} ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="map-container"
      >
        {!mapLoaded && (
          <div className="map-loading">
            <div className="loading-spinner"></div>
            <p>Loading interactive map...</p>
          </div>
        )}
      </div>
      
      {/* Sidebar with place list */}
      <AnimatePresence>
        {showSidebar && mapLoaded && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="map-sidebar"
          >
            <div className="sidebar-header">
              <h3>
                <FiMapPin className="sidebar-icon" />
                Places in View
              </h3>
              <button 
                className="close-button"
                onClick={() => setShowSidebar(false)}
                aria-label="Close sidebar"
              >
                <FiX />
              </button>
            </div>
            
            <div className="sidebar-search">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search places..."
                className="sidebar-search-input"
              />
              <FiSearch className="search-icon" />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              )}
            </div>
            
            <div className="sidebar-stats">
              <div className="stat">
                <span className="stat-label">Visible:</span>
                <span className="stat-value">{visiblePlaces.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total:</span>
                <span className="stat-value">{places.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Zoom:</span>
                <span className="stat-value">{mapMetrics.zoom}x</span>
              </div>
            </div>
            
            <div className="sidebar-places">
              {filteredPlaces.length === 0 ? (
                <div className="no-places">
                  <FiInfo className="info-icon" />
                  <p>No places match your search</p>
                </div>
              ) : (
                filteredPlaces.map(place => {
                  const isCurrentlySelected = selectedPlace?.id === place.id;
                  const isVisible = visiblePlaces.some(p => p.id === place.id);
                  
                  return (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`place-item ${isCurrentlySelected ? 'selected' : ''} ${isVisible ? 'visible' : 'not-visible'}`}
                      onClick={() => onSelectPlace(place)}
                      onMouseEnter={() => setHoveredPlace(place)}
                      onMouseLeave={() => setHoveredPlace(null)}
                    >
                      <div className="place-icon">
                        {isVisible ? (
                          <FiEye className="visible-icon" />
                        ) : (
                          <FiMapPin className="pin-icon" />
                        )}
                      </div>
                      <div className="place-info">
                        <h4>{place.name}</h4>
                        <p>{place.location}{place.district ? `, ${place.district}` : ''}</p>
                        {place.rating_count > 0 && (
                          <div className="place-rating">
                            <FiStar className="star-icon" />
                            <span>{(place.rating_sum / place.rating_count).toFixed(1)}</span>
                            <span className="review-count">({place.rating_count})</span>
                          </div>
                        )}
                      </div>
                      <div className="place-actions">
                        {isCurrentlySelected ? (
                          <FiCheck className="check-icon" />
                        ) : (
                          <FiArrowRight className="arrow-icon" />
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
            
            <div className="sidebar-footer">
              <p>
                <FiInfo className="info-icon-small" />
                Click on a place to view details
              </p>
              <p className="attribution">
                <span>Map data © OpenStreetMap</span>
                <span>AdminX</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Map controls */}
      {mapLoaded && (
        <>
          {/* Top left controls - Search and toggle sidebar */}
          <div className="map-control top-left">
            <div className="search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search places on map..."
                className="search-input"
              />
              <FiSearch className="search-icon" />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              )}
            </div>
            
            <button 
              className="control-button sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label="Toggle sidebar"
            >
              {showSidebar ? <FiChevronRight /> : <FiChevronLeft />}
              <span>{showSidebar ? 'Hide List' : 'Show List'}</span>
            </button>
          </div>
          
          {/* Top right controls - Layer switcher */}
          <div className="map-control top-right">
            <div className="map-style-switcher">
              <button
                className="control-button layers-button"
                onClick={() => setShowLayers(!showLayers)}
                aria-label="Change map style"
              >
                <FiLayers />
                <span>Styles</span>
              </button>
              
              <AnimatePresence>
                {showLayers && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="map-style-dropdown"
                  >
                    {TILE_LAYERS.map(layer => (
                      <button
                        key={layer.id}
                        className={`style-option ${tileLayer === layer.url ? 'active' : ''}`}
                        onClick={() => {
                          setTileLayer(layer.url);
                          setShowLayers(false);
                        }}
                      >
                        {layer.icon}
                        <span>{layer.name}</span>
                        {tileLayer === layer.url && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="check-icon"
                          >
                            <FiCheck />
                          </motion.div>
                        )}
                      </button>
                    ))}
                    
                    <div className="style-dropdown-footer">
                      <button
                        className={`cluster-toggle ${clusterMode ? 'active' : ''}`}
                        onClick={() => setClusterMode(!clusterMode)}
                      >
                        <span>Cluster Mode</span>
                        <div className={`toggle-switch ${clusterMode ? 'on' : 'off'}`}>
                          <div className="toggle-handle"></div>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <button
              className="control-button fullscreen-button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
            </button>
          </div>
          
          {/* Bottom center controls - Map stats */}
          <div className="map-control bottom-center">
            <div className="map-stats">
              <div className="stat">
                <FiMapPin className="stat-icon" />
                <span>{visiblePlaces.length}/{places.length}</span>
              </div>
              <div className="stat">
                <FiTarget className="stat-icon" />
                <span>Z: {mapMetrics.zoom.toFixed(1)}</span>
              </div>
            </div>
          </div>
          
          {/* Custom zoom controls */}
          <div className="map-control custom-zoom">
            <button
              className="zoom-button zoom-in"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.zoomIn();
                }
              }}
              aria-label="Zoom in"
            >
              <FiPlus />
            </button>
            <button
              className="zoom-button zoom-out"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.zoomOut();
                }
              }}
              aria-label="Zoom out"
            >
              <FiMinus />
            </button>
          </div>
          
          {/* Locate me button */}
          <button
            className="map-control geolocate-control"
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.locate({
                  setView: true,
                  maxZoom: 16,
                  enableHighAccuracy: true
                });
              }
            }}
            aria-label="Show my location"
          >
            <FiCrosshair />
          </button>
        </>
      )}
      
      {/* Map styling */}
      <style jsx>{`
        .map-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 0.75rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .map-wrapper.fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          z-index: 9999;
          border-radius: 0;
        }
        
        .map-container {
          width: 100%;
          height: 100%;
          background-color: #f3f4f6;
        }
        
        .map-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: rgba(255, 255, 255, 0.9);
          z-index: 10;
          backdrop-filter: blur(4px);
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #4F46E5;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .map-error-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f3f4f6;
          border-radius: 0.75rem;
        }
        
        .map-error {
          background-color: white;
          padding: 2rem;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          text-align: center;
          max-width: 400px;
        }
        
        .error-icon {
          font-size: 2.5rem;
          color: #EF4444;
          margin-bottom: 1rem;
        }
        
        .map-error h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #1F2937;
        }
        
        .map-error p {
          color: #6B7280;
          margin-bottom: 1.5rem;
        }
        
        .map-error button {
          background-color: #4F46E5;
          color: white;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: 0.375rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .map-error button:hover {
          background-color: #4338CA;
        }
        
        .refresh-icon {
          margin-right: 0.5rem;
        }
        
        .map-sidebar {
          position: absolute;
          top: 0;
          right: 0;
          width: 320px;
          height: 100%;
          background-color: white;
          box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .sidebar-header {
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .sidebar-header h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1F2937;
          display: flex;
          align-items: center;
        }
        
        .sidebar-icon {
          margin-right: 0.5rem;
          color: #4F46E5;
        }
        
        .close-button {
          background: none;
          border: none;
          cursor: pointer;
          color: #6B7280;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }
        
        .close-button:hover {
          background-color: #f3f4f6;
          color: #1F2937;
        }
        
        .sidebar-search {
          padding: 1rem;
          position: relative;
        }
        
        .sidebar-search-input {
          width: 100%;
          padding: 0.5rem 2.5rem 0.5rem 2.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 9999px;
          background-color: #f9fafb;
          font-size: 0.875rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        .sidebar-search-input:focus {
          outline: none;
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
          background-color: white;
        }
        
        .search-icon {
          position: absolute;
          left: 1.5rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9CA3AF;
          pointer-events: none;
        }
        
        .clear-search {
          position: absolute;
          right: 1.5rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9CA3AF;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
        }
        
        .clear-search:hover {
          color: #4B5563;
        }
        
        .sidebar-stats {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }
        
        .stat {
          display: flex;
          align-items: center;
          font-size: 0.75rem;
          color: #6B7280;
        }
        
        .stat-label {
          margin-right: 0.25rem;
        }
        
        .stat-value {
          font-weight: 600;
          color: #4B5563;
        }
        
        .sidebar-places {
          flex-grow: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }
        
        .no-places {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: #6B7280;
        }
        
        .info-icon {
          font-size: 1.5rem;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
        }
        
        .place-item {
          display: flex;
          align-items: center;
          padding: 0.75rem;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: background-color 0.2s;
          border: 1px solid transparent;
        }
        
        .place-item:hover {
          background-color: #f3f4f6;
        }
        
        .place-item.selected {
          background-color: #EEF2FF;
          border-color: #C7D2FE;
        }
        
        .place-item.not-visible {
          opacity: 0.6;
        }
        
        .place-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #F3F4F6;
          border-radius: 50%;
          margin-right: 0.75rem;
        }
        
        .place-item.selected .place-icon {
          background-color: #4F46E5;
          color: white;
        }
        
        .visible-icon, .pin-icon {
          color: #4B5563;
        }
        
        .place-item.selected .visible-icon,
        .place-item.selected .pin-icon {
          color: white;
        }
        
        .place-info {
          flex-grow: 1;
        }
        
        .place-info h4 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1F2937;
          margin-bottom: 0.25rem;
        }
        
        .place-info p {
          font-size: 0.75rem;
          color: #6B7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }
        
        .place-rating {
          display: flex;
          align-items: center;
          font-size: 0.75rem;
          color: #1F2937;
          margin-top: 0.25rem;
        }
        
        .star-icon {
          color: #FBBF24;
          margin-right: 0.25rem;
        }
        
        .review-count {
          color: #6B7280;
          margin-left: 0.25rem;
        }
        
        .place-actions {
          display: flex;
          align-items: center;
        }
        
        .arrow-icon, .check-icon {
          color: #6B7280;
        }
        
        .place-item.selected .arrow-icon,
        .place-item.selected .check-icon {
          color: #4F46E5;
        }
        
        .sidebar-footer {
          padding: 0.75rem 1rem;
          border-top: 1px solid #e5e7eb;
          font-size: 0.75rem;
          color: #6B7280;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background-color: #f9fafb;
        }
        
        .sidebar-footer p {
          display: flex;
          align-items: center;
        }
        
        .info-icon-small {
          margin-right: 0.25rem;
          font-size: 0.875rem;
        }
        
        .attribution {
          display: flex;
          justify-content: space-between;
          color: #9CA3AF;
          font-size: 0.7rem;
        }
        
        .map-control {
          position: absolute;
          z-index: 500;
        }
        
        .map-control.top-left {
          top: 1rem;
          left: 1rem;
          display: flex;
          align-items: center;
        }
        
        .map-control.top-right {
          top: 1rem;
          right: 1rem;
          display: flex;
          gap: 0.5rem;
        }
        
        .map-control.bottom-center {
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .map-control.custom-zoom {
          top: 50%;
          right: 1rem;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .map-control.geolocate-control {
          bottom: 5rem;
          right: 1rem;
          width: 40px;
          height: 40px;
          background-color: white;
          border-radius: 4px;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          color: #4B5563;
          transition: background-color 0.2s;
        }
        
        .map-control.geolocate-control:hover {
          background-color: #f9fafb;
        }
        
        .search-container {
          position: relative;
          margin-right: 0.5rem;
        }
        
        .search-input {
          width: 240px;
          padding: 0.5rem 2.5rem 0.5rem 2.5rem;
          border: none;
          border-radius: 9999px;
          background-color: white;
          font-size: 0.875rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
          transition: width 0.2s, box-shadow 0.2s;
        }
        
        .search-input:focus {
          outline: none;
          width: 280px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .control-button {
          background-color: white;
          border: none;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #4B5563;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
          transition: background-color 0.2s;
        }
        
        .control-button:hover {
          background-color: #f9fafb;
        }
        
        .control-button svg {
          margin-right: 0.5rem;
        }
        
        .control-button.sidebar-toggle svg {
          font-size: 1rem;
        }
        
        .control-button.layers-button {
          padding: 0.5rem;
          margin-right: 0.5rem;
        }
        
        .control-button.fullscreen-button {
          padding: 0.5rem;
          width: 40px;
          height: 40px;
        }
        
        .control-button.fullscreen-button svg {
          margin-right: 0;
        }
        
        .map-style-switcher {
          position: relative;
        }
        
        .map-style-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          width: 200px;
          z-index: 30;
          overflow: hidden;
        }
        
        .style-option {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          font-size: 0.875rem;
          color: #4B5563;
          transition: background-color 0.2s;
        }
        
        .style-option:hover {
          background-color: #f3f4f6;
        }
        
        .style-option.active {
          background-color: #EEF2FF;
          color: #4F46E5;
          font-weight: 500;
        }
        
        .style-option svg {
          margin-right: 0.75rem;
          font-size: 1.125rem;
        }
        
        .check-icon {
          margin-left: auto;
          color: #4F46E5;
        }
        
        .style-dropdown-footer {
          padding: 0.75rem 1rem;
          border-top: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }
        
        .cluster-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          background: none;
          border: none;
          padding: 0;
          font-size: 0.875rem;
          color: #4B5563;
          cursor: pointer;
        }
        
        .toggle-switch {
          width: 36px;
          height: 20px;
          background-color: #e5e7eb;
          border-radius: 9999px;
          position: relative;
          transition: background-color 0.2s;
        }
        
        .toggle-switch.on {
          background-color: #4F46E5;
        }
        
        .toggle-handle {
          width: 16px;
          height: 16px;
          background-color: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }
        
        .toggle-switch.on .toggle-handle {
          transform: translateX(16px);
        }
        
        .map-stats {
          display: flex;
          align-items: center;
          gap: 1rem;
          background-color: rgba(255, 255, 255, 0.8);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          backdrop-filter: blur(4px);
          color: #4B5563;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .stat {
          display: flex;
          align-items: center;
          font-weight: 500;
        }
        
        .stat-icon {
          margin-right: 0.25rem;
          font-size: 0.875rem;
        }
        
        .zoom-button {
          width: 40px;
          height: 40px;
          background-color: white;
          border: none;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4B5563;
          font-size: 1.125rem;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
          transition: background-color 0.2s;
        }
        
        .zoom-button:hover {
          background-color: #f9fafb;
        }
        
        @media (max-width: 768px) {
          .map-wrapper {
            border-radius: 0.5rem;
          }
          
          .map-control.top-left {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          
          .search-container {
            margin-right: 0;
            margin-bottom: 0.5rem;
          }
          
          .search-input {
            width: 180px;
          }
          
          .search-input:focus {
            width: 220px;
          }
          
          .control-button span {
            display: none;
          }
          
          .control-button svg {
            margin-right: 0;
          }
          
          .map-sidebar {
            width: 100%;
          }
          
          .map-stats {
            display: none;
          }
          
          .custom-zoom {
            right: 0.5rem;
          }
          
          .map-control.geolocate-control {
            bottom: 4rem;
            right: 0.5rem;
          }
        }
        
        @media (max-width: 480px) {
          .map-control.top-left,
          .map-control.top-right {
            top: 0.5rem;
          }
          
          .map-control.top-left {
            left: 0.5rem;
          }
          
          .map-control.top-right {
            right: 0.5rem;
          }
          
          .search-input {
            width: 150px;
            padding: 0.375rem 2rem 0.375rem 2rem;
          }
          
          .search-input:focus {
            width: 180px;
          }
          
          .custom-zoom {
            display: none;
          }
        }
      `}</style>
      
      {/* Leaflet specific styling */}
      <style jsx global>{`
        /* Custom marker styling */
        .custom-marker-icon {
          background: none;
          border: none;
        }
        
        .marker-pin {
          width: 30px;
          height: 42px;
          background-color: #4F46E5;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          border: 2px solid white;
          position: relative;
        }
        
        .marker-pin.selected {
          background-color: #EF4444;
          transform: rotate(-45deg) scale(1.2);
          z-index: 1000 !important;
        }
        
        .marker-icon {
          transform: rotate(45deg);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .rating {
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 12px;
          display: flex;
          align-items: center;
        }
        
        .rating svg {
          margin-right: 2px;
        }
        
        .marker-pulse {
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: rgba(239, 68, 68, 0.4);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: -1;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          70% {
            opacity: 0.2;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
        
        /* Cluster marker styling */
        .cluster-marker {
          background-color: #4F46E5;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border: 3px solid white;
        }
        
        .cluster-marker.small {
          width: 40px;
          height: 40px;
          font-size: 14px;
        }
        
        .cluster-marker.medium {
          width: 50px;
          height: 50px;
          font-size: 16px;
        }
        
        .cluster-marker.large {
          width: 60px;
          height: 60px;
          font-size: 18px;
        }
        
        /* Custom popup styling */
        .leaflet-popup-content-wrapper {
          padding: 0;
          overflow: hidden;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .leaflet-popup-content {
          margin: 0;
          width: 280px !important;
        }
        
        .leaflet-popup-tip {
          background-color: white;
        }
        
        .custom-popup {
          width: 100%;
        }
        
        .popup-header {
          background-color: #4F46E5;
          color: white;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .popup-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        
        .popup-header .rating {
          background-color: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 12px;
          display: flex;
          align-items: center;
          transform: none;
        }
        
        .popup-body {
          padding: 12px 16px;
          background-color: white;
        }
        
        .popup-body p {
          margin: 0 0 8px;
          font-size: 14px;
          color: #4B5563;
        }
        
        .popup-body .description {
          color: #6B7280;
          font-size: 13px;
          line-height: 1.4;
        }
        
        .popup-footer {
          padding: 12px 16px;
          background-color: #f9fafb;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
        }
        
        .view-button {
          background-color: #4F46E5;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: background-color 0.2s;
        }
        
        .view-button:hover {
          background-color: #4338CA;
          text-decoration: none;
          color: white;
        }
        
        /* Custom tooltip */
        .custom-tooltip {
          background-color: rgba(0, 0, 0, 0.8);
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        /* Leaflet marker cluster styles */
        .leaflet-marker-cluster {
          background: none !important;
        }
        
        .leaflet-marker-cluster div {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default ExploreMap;