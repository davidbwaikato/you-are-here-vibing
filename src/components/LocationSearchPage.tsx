import { MapPin, ArrowRight } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

export interface LocationError {
  attemptedLocation: string;
  errorMessage: string;
}

interface LocationSearchPageProps {
  sourceError: LocationError | null;
  destinationError: LocationError | null;
}

interface LocationColumnProps {
  title: string;
  hasError: boolean;
  attemptedLocation?: string;
  recognizedLocation?: { lat: number; lng: number; address: string };
  paramName: 'src' | 'dst';
  defaultLocation: { name: string; lat: number; lng: number };
  onLocationChange: (location: { lat: number; lng: number; address: string }) => void;
}

const GoogleMapEmbed = ({ 
  location, 
  title,
  onLoad,
  onLocationChange
}: { 
  location: { lat: number; lng: number }; 
  title: string;
  onLoad: () => void;
  onLocationChange?: (location: { lat: number; lng: number; shortName: string; fullAddress: string }) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!window.google || !window.google.maps) {
      console.warn('[GoogleMapEmbed] Google Maps not loaded yet');
      return;
    }

    if (!containerRef.current || !autocompleteContainerRef.current) {
      console.warn('[GoogleMapEmbed] Container refs not available');
      return;
    }

    if (mountedRef.current) {
      // Already initialized, just update position
      if (mapInstanceRef.current && markerRef.current) {
        const newPos = { lat: location.lat, lng: location.lng };
        mapInstanceRef.current.setCenter(newPos);
        markerRef.current.setPosition(newPos);
        markerRef.current.setTitle(title);
      }
      return;
    }

    console.log('[GoogleMapEmbed] Initializing map and autocomplete:', location);

    try {
      // Create map
      const map = new google.maps.Map(containerRef.current, {
        center: { lat: location.lat, lng: location.lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;

      // Create marker
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: title,
      });

      markerRef.current = marker;

      // Create PlaceAutocompleteElement
      const autocomplete = new google.maps.places.PlaceAutocompleteElement();
      autocompleteContainerRef.current.appendChild(autocomplete);
      autocompleteRef.current = autocomplete;

      console.log('[GoogleMapEmbed] Autocomplete element created, attaching event listener...');

      // Use the correct event name and structure from Google's documentation
      autocomplete.addEventListener('gmp-select', async ({ placePrediction }: any) => {
        console.log('[GoogleMapEmbed] ✅ gmp-select event fired!');
        console.log('[GoogleMapEmbed] placePrediction:', placePrediction);

        try {
          // Convert placePrediction to Place object
          const place = placePrediction.toPlace();
          console.log('[GoogleMapEmbed] Place object created:', place);

          // Fetch place details
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location']
          });

          console.log('[GoogleMapEmbed] Place details fetched:', {
            displayName: place.displayName,
            formattedAddress: place.formattedAddress,
            location: place.location
          });

          if (!place.location) {
            console.warn('[GoogleMapEmbed] ⚠️ Selected place has no location');
            return;
          }

          const newLocation = {
            lat: place.location.lat(),
            lng: place.location.lng(),
          };

          // Prioritize displayName for short version, fallback to formattedAddress
          const shortName = place.displayName || place.formattedAddress || 'Unknown location';
          const fullAddress = place.formattedAddress || place.displayName || 'Unknown location';

          console.log('[GoogleMapEmbed] 🗺️ Updating map to:', newLocation, 'Short:', shortName, 'Full:', fullAddress);

          // Update map and marker
          map.setCenter(newLocation);
          map.setZoom(15);
          marker.setPosition(newLocation);
          marker.setTitle(fullAddress);

          console.log('[GoogleMapEmbed] ✅ Map and marker updated');

          // Notify parent component with BOTH short name and full address
          if (onLocationChange) {
            console.log('[GoogleMapEmbed] 📢 Notifying parent - Short:', shortName, 'Full:', fullAddress);
            onLocationChange({
              lat: newLocation.lat,
              lng: newLocation.lng,
              shortName: shortName,
              fullAddress: fullAddress,
            });
          }
        } catch (error) {
          console.error('[GoogleMapEmbed] ❌ Error handling place selection:', error);
        }
      });

      console.log('[GoogleMapEmbed] ✅ Event listener attached to autocomplete element');

      mountedRef.current = true;
      onLoad();
    } catch (error) {
      console.error('[GoogleMapEmbed] ❌ Error initializing map:', error);
    }

    // Cleanup on unmount only
    return () => {
      console.log('[GoogleMapEmbed] 🧹 Cleaning up map and autocomplete');
      if (autocompleteRef.current && autocompleteContainerRef.current) {
        try {
          autocompleteContainerRef.current.removeChild(autocompleteRef.current);
        } catch (e) {
          console.warn('[GoogleMapEmbed] ⚠️ Error removing autocomplete:', e);
        }
        autocompleteRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
      mountedRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  // Update map when location changes externally
  useEffect(() => {
    if (mountedRef.current && mapInstanceRef.current && markerRef.current) {
      const newPos = { lat: location.lat, lng: location.lng };
      mapInstanceRef.current.setCenter(newPos);
      markerRef.current.setPosition(newPos);
      markerRef.current.setTitle(title);
    }
  }, [location.lat, location.lng, title]);

  return (
    <div className="space-y-3">
      {/* Map Container */}
      <div 
        ref={containerRef}
        className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
      />
      
      {/* Autocomplete Container */}
      <div 
        ref={autocompleteContainerRef}
        className="w-full"
      />
    </div>
  );
};

const LocationColumn = ({ 
  title, 
  hasError, 
  attemptedLocation,
  recognizedLocation,
  paramName, 
  defaultLocation,
  onLocationChange
}: LocationColumnProps) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(recognizedLocation || defaultLocation);
  
  // Track if user has selected a valid location (overrides error state)
  const [hasValidSelection, setHasValidSelection] = useState(!hasError);
  
  // Separate state for status message (short name) and "Show:" label (full address)
  const [statusDisplayName, setStatusDisplayName] = useState<string>(
    recognizedLocation?.address || defaultLocation.name
  );
  const [showLabelAddress, setShowLabelAddress] = useState<string>(
    recognizedLocation?.address || defaultLocation.name
  );

  // Determine which location to show on the map
  const mapLocation = currentLocation;
  const showPlaceMarker = !!recognizedLocation;

  const handleLocationChange = (newLocation: { lat: number; lng: number; shortName: string; fullAddress: string }) => {
    console.log('[LocationColumn] 📍 Location changed - Short:', newLocation.shortName, 'Full:', newLocation.fullAddress);
    
    // Mark that user has selected a valid location (clears error state)
    setHasValidSelection(true);
    
    // Update map location
    setCurrentLocation({
      lat: newLocation.lat,
      lng: newLocation.lng,
      name: newLocation.fullAddress,
    });
    
    // Update status message with SHORT name
    setStatusDisplayName(newLocation.shortName);
    
    // Update "Show:" label with FULL address
    setShowLabelAddress(newLocation.fullAddress);
    
    // Notify parent with full address for navigation
    onLocationChange({
      lat: newLocation.lat,
      lng: newLocation.lng,
      address: newLocation.fullAddress,
    });
  };

  // Determine if we should show error or success message
  const showError = hasError && !hasValidSelection;

  return (
    <div className="flex-1 space-y-6">
      {/* Column Header */}
      <div className="text-center">
        <h2 className="text-2xl font-medium text-slate-800 mb-2">
          {title}
        </h2>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full" />
      </div>

      {/* Compact Status Message - Single Line - Updates with SHORT NAME */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[80px] flex items-center justify-center">
        {showError ? (
          <p className="text-slate-600 text-sm font-light text-center">
            <span className="text-red-500 font-medium">✗</span> Sorry, we couldn't find: <span className="font-medium text-slate-800">{attemptedLocation}</span>
          </p>
        ) : (
          <p className="text-slate-700 text-sm font-light text-center">
            <span className="text-green-600 font-medium">✓</span> Location recognized: <span className="font-medium text-slate-800">{statusDisplayName}</span>
          </p>
        )}
      </div>

      {/* Google Maps Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm">
        <p className="text-slate-700 text-sm font-medium mb-4">
          Search for a location:
        </p>
        
        {/* Embedded Google Map with Autocomplete */}
        {!mapLoaded && (
          <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              <p className="text-sm">Loading map...</p>
            </div>
          </div>
        )}
        
        <div style={{ display: mapLoaded ? 'block' : 'none' }}>
          <GoogleMapEmbed
            location={mapLocation}
            title={showPlaceMarker ? recognizedLocation!.address : defaultLocation.name}
            onLoad={() => setMapLoaded(true)}
            onLocationChange={handleLocationChange}
          />
        </div>

        {/* Map Caption - Shows FULL ADDRESS */}
        <p className="text-slate-500 text-xs mt-3 text-center font-light">
          Showing: {showLabelAddress}
        </p>
      </div>
    </div>
  );
};

export const LocationSearchPage = ({ 
  sourceError,
  destinationError
}: LocationSearchPageProps) => {
  // Default locations
  const defaultSourceLocation = {
    name: 'Trevi Fountain',
    lat: 41.9007576,
    lng: 12.4832866,
  };

  const defaultDestinationLocation = {
    name: 'Spanish Steps',
    lat: 41.9058403,
    lng: 12.4822975,
  };

  // Parse URL parameters to get initial locations
  const urlParams = new URLSearchParams(window.location.search);
  const srcParam = urlParams.get('src');
  const dstParam = urlParams.get('dst');

  // Initialize locations from URL params or defaults
  const getInitialSourceLocation = () => {
    if (srcParam && !sourceError) {
      const [lat, lng] = srcParam.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { name: 'URL Location', lat, lng };
      }
    }
    return defaultSourceLocation;
  };

  const getInitialDestinationLocation = () => {
    if (dstParam && !destinationError) {
      const [lat, lng] = dstParam.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { name: 'URL Location', lat, lng };
      }
    }
    return defaultDestinationLocation;
  };

  // Track current locations for both columns
  const [sourceLocation, setSourceLocation] = useState(getInitialSourceLocation());
  const [destinationLocation, setDestinationLocation] = useState(getInitialDestinationLocation());

  // Check if both locations are valid (button should be enabled)
  const isButtonEnabled = !sourceError && !destinationError;

  // Popular walking routes with sensible distances
  const popularRoutes = [
    {
      src: 'Trevi Fountain',
      dst: 'Spanish Steps',
      city: 'Rome',
      distance: '850m',
      srcCoords: { lat: 41.9007576, lng: 12.4832866 },
      dstCoords: { lat: 41.9058403, lng: 12.4822975 }
    },
    {
      src: 'Arc de Triomphe',
      dst: 'Eiffel Tower',
      city: 'Paris',
      distance: '2.3km',
      srcCoords: { lat: 48.8737917, lng: 2.2950275 },
      dstCoords: { lat: 48.8583701, lng: 2.2944813 }
    },
    {
      src: 'Times Square',
      dst: 'Central Park',
      city: 'New York',
      distance: '1.1km',
      srcCoords: { lat: 40.758896, lng: -73.9851644 },
      dstCoords: { lat: 40.7828647, lng: -73.9653551 }
    },
    {
      src: 'Big Ben',
      dst: 'Buckingham Palace',
      city: 'London',
      distance: '1.4km',
      srcCoords: { lat: 51.5007292, lng: -0.1246254 },
      dstCoords: { lat: 51.501364, lng: -0.14189 }
    },
    {
      src: 'Opera House',
      dst: 'Harbour Bridge',
      city: 'Sydney',
      distance: '1.6km',
      srcCoords: { lat: -33.8567844, lng: 151.213108 },
      dstCoords: { lat: -33.8523063, lng: 151.2107871 }
    }
  ];

  const handleStartExploration = () => {
    if (!isButtonEnabled) return;

    // Navigate to main app with current locations and start flag
    const params = new URLSearchParams();
    params.set('src', `${sourceLocation.lat},${sourceLocation.lng}`);
    params.set('dst', `${destinationLocation.lat},${destinationLocation.lng}`);
    params.set('start', 'true'); // Flag to indicate user wants to start
    window.location.href = `/?${params.toString()}`;
  };

  const handleRouteClick = (route: typeof popularRoutes[0]) => {
    // Navigate to main app with preset route and start flag
    const params = new URLSearchParams();
    params.set('src', `${route.srcCoords.lat},${route.srcCoords.lng}`);
    params.set('dst', `${route.dstCoords.lat},${route.dstCoords.lng}`);
    params.set('start', 'true'); // Flag to indicate user wants to start
    window.location.href = `/?${params.toString()}`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8 w-full">
        {/* Logo/Icon with Friendly State */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl rounded-full" />
            <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-2xl shadow-2xl">
              <MapPin className="w-16 h-16 text-white" strokeWidth={1.5} />
              <div className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg">
                <span className="text-blue-500 text-2xl">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl font-light tracking-tight text-slate-900 text-center mb-12">
          {sourceError || destinationError ? (
            <>Let's Find <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Location</span></>
          ) : (
            <>Review <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Locations</span></>
          )}
        </h1>

        {/* Two Column Layout - ALWAYS SHOW BOTH */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Source Location Column - ALWAYS SHOWN */}
          <LocationColumn
            title="Starting Point"
            hasError={!!sourceError}
            attemptedLocation={sourceError?.attemptedLocation}
            recognizedLocation={!sourceError && srcParam ? undefined : undefined}
            paramName="src"
            defaultLocation={defaultSourceLocation}
            onLocationChange={(loc) => setSourceLocation({ name: loc.address, lat: loc.lat, lng: loc.lng })}
          />

          {/* Divider - ALWAYS SHOWN */}
          <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent" />

          {/* Destination Location Column - ALWAYS SHOWN */}
          <LocationColumn
            title="Destination"
            hasError={!!destinationError}
            attemptedLocation={destinationError?.attemptedLocation}
            recognizedLocation={!destinationError && dstParam ? undefined : undefined}
            paramName="dst"
            defaultLocation={defaultDestinationLocation}
            onLocationChange={(loc) => setDestinationLocation({ name: loc.address, lat: loc.lat, lng: loc.lng })}
          />
        </div>

        {/* Start Exploration Button - Full Width of Columns Above */}
        <button
          onClick={handleStartExploration}
          disabled={!isButtonEnabled}
          className={`w-full group relative overflow-hidden ${
            isButtonEnabled
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 cursor-pointer'
              : 'bg-gradient-to-r from-slate-300 to-slate-400 cursor-not-allowed'
          } text-white font-medium py-6 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform ${
            isButtonEnabled ? 'hover:scale-[1.01]' : ''
          } mb-12`}
        >
          {isButtonEnabled && (
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          )}
          <div className="relative flex items-center justify-center gap-3">
            <span className="text-xl">
              {isButtonEnabled ? 'Start Your Exploration' : 'Please Select Valid Locations'}
            </span>
            {isButtonEnabled && (
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            )}
          </div>
        </button>

        {/* Popular Routes - Full Width */}
        <div className="w-full">
          <p className="text-slate-600 text-sm font-light mb-4 text-center">
            Or explore these popular walking routes:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {popularRoutes.map((route, index) => (
              <button
                key={index}
                onClick={() => handleRouteClick(route)}
                className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 p-4 rounded-xl transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{route.city}</span>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{route.distance}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-700 font-medium truncate">{route.src}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  <span className="text-slate-700 font-medium truncate">{route.dst}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
