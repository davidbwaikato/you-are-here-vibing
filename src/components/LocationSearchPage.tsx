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
  onInvalidLocation?: (attemptedText: string) => void;
}

const GoogleMapEmbed = ({ 
  location, 
  title,
  onLoad,
  onLocationChange,
  onInvalidLocation,
  onEditingStateChange
}: { 
  location: { lat: number; lng: number }; 
  title: string;
  onLoad: () => void;
  onLocationChange?: (location: { lat: number; lng: number; shortName: string; fullAddress: string }) => void;
  onInvalidLocation?: (attemptedText: string) => void;
  onEditingStateChange?: (isEditing: boolean) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const mountedRef = useRef(false);
  
  // State management for marker visibility and display name
  const committedPlaceRef = useRef<google.maps.places.Place | null>(null);
  const editedSinceFocusRef = useRef(false);
  const [markerVisible, setMarkerVisible] = useState(true); // Start with marker visible (default location)
  const [displayName, setDisplayName] = useState(title); // Track the short name to display
  
  // Track the last location coordinates to detect external changes
  const lastLocationRef = useRef({ lat: location.lat, lng: location.lng });

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
      // Already initialized, just update position if location changed externally
      if (mapInstanceRef.current && markerRef.current) {
        const locationChanged = 
          lastLocationRef.current.lat !== location.lat || 
          lastLocationRef.current.lng !== location.lng;
        
        if (locationChanged) {
          console.log('[GoogleMapEmbed] 🔄 External location change detected');
          const newPos = { lat: location.lat, lng: location.lng };
          mapInstanceRef.current.setCenter(newPos);
          markerRef.current.setPosition(newPos);
          markerRef.current.setTitle(title);
          setDisplayName(title); // Only update display name on external location change
          lastLocationRef.current = { lat: location.lat, lng: location.lng };
        }
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
        visible: true, // Start visible (default location)
      });

      markerRef.current = marker;

      // Create PlaceAutocompleteElement
      const autocomplete = new google.maps.places.PlaceAutocompleteElement();
      autocomplete.style.border = '1px solid black';
      autocomplete.style.position = 'relative';
      autocomplete.style.zIndex = '9999';
      autocompleteContainerRef.current.appendChild(autocomplete);
      autocompleteRef.current = autocomplete;

      console.log('[GoogleMapEmbed] Autocomplete element created');

      // ============================================================================
      // MARKER VISIBILITY STATE MANAGEMENT
      // ============================================================================

      // Helper functions for marker visibility
      const hideMarker = () => {
        console.log('[GoogleMapEmbed] 🙈 Hiding marker (user is editing)');
        if (markerRef.current) {
          markerRef.current.setVisible(false);
        }
        setMarkerVisible(false);
      };

      const showMarkerAt = (position: google.maps.LatLng, placeName: string, shortName: string) => {
        console.log('[GoogleMapEmbed] 👁️ Showing marker at:', position.lat(), position.lng());
        console.log('[GoogleMapEmbed] 📝 Display name:', shortName);
        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setPosition(position);
          markerRef.current.setTitle(placeName);
          markerRef.current.setVisible(true);
          mapInstanceRef.current.setCenter(position);
          mapInstanceRef.current.setZoom(15);
          
          // Update last location ref to prevent external update from overwriting
          lastLocationRef.current = { lat: position.lat(), lng: position.lng() };
        }
        setMarkerVisible(true);
        setDisplayName(shortName); // Update the display name
      };

      // FOCUS EVENT: Reset edited flag
      const handleFocus = () => {
        console.log('[GoogleMapEmbed] 🎯 FOCUS: Resetting editedSinceFocus flag');
        editedSinceFocusRef.current = false;
      };

      autocomplete.addEventListener('focus', handleFocus);

      // INPUT EVENT: User started typing
      const handleInput = () => {
        if (!editedSinceFocusRef.current) {
          console.log('[GoogleMapEmbed] ⌨️ INPUT: User started editing, hiding marker');
          editedSinceFocusRef.current = true;
          hideMarker();
          
          // Notify parent that user is editing
          if (onEditingStateChange) {
            onEditingStateChange(true);
          }
        }
      };

      autocomplete.addEventListener('input', handleInput);

      // GMP-SELECT EVENT: User selected a place
      autocomplete.addEventListener('gmp-select', async ({ placePrediction }: any) => {
        console.log('[GoogleMapEmbed] ✅ GMP-SELECT: Place selected');

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

          // Store as committed place
          committedPlaceRef.current = place;
          editedSinceFocusRef.current = false;

          const newLocation = {
            lat: place.location.lat(),
            lng: place.location.lng(),
          };

          const shortName = place.displayName || place.formattedAddress || 'Unknown location';
          const fullAddress = place.formattedAddress || place.displayName || 'Unknown location';

          console.log('[GoogleMapEmbed] 📝 Short name:', shortName);
          console.log('[GoogleMapEmbed] 📍 Full address:', fullAddress);

          // Show marker at selected location with short name
          showMarkerAt(place.location, fullAddress, shortName);

          // Notify parent that editing is complete
          if (onEditingStateChange) {
            onEditingStateChange(false);
          }

          // Notify parent component
          if (onLocationChange) {
            console.log('[GoogleMapEmbed] 📢 Notifying parent');
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

      // BLUR EVENT: User clicked away
      const handleBlur = () => {
        console.log('[GoogleMapEmbed] 🔍 BLUR: User clicked away');
        
        // If they focused and clicked away without editing, do nothing
        if (!editedSinceFocusRef.current) {
          console.log('[GoogleMapEmbed] No edits made, keeping current state');
          return;
        }

        // If they edited but didn't select a place
        console.log('[GoogleMapEmbed] User edited but did not select');
        
        if (committedPlaceRef.current) {
          // Option A (conservative): Revert to last valid place
          console.log('[GoogleMapEmbed] 🔄 Reverting to last committed place');
          const lastPlace = committedPlaceRef.current;
          
          if (lastPlace.location) {
            const shortName = lastPlace.displayName || lastPlace.formattedAddress || 'Unknown location';
            const fullAddress = lastPlace.formattedAddress || lastPlace.displayName || 'Unknown location';
            showMarkerAt(lastPlace.location, fullAddress, shortName);
            
            // Notify parent that editing is complete (reverted)
            if (onEditingStateChange) {
              onEditingStateChange(false);
            }
            
            // Notify parent to revert UI
            if (onLocationChange) {
              onLocationChange({
                lat: lastPlace.location.lat(),
                lng: lastPlace.location.lng(),
                shortName: shortName,
                fullAddress: fullAddress,
              });
            }
          }
        } else {
          // Option B (strict): Keep hidden until new selection
          console.log('[GoogleMapEmbed] 🙈 No committed place, keeping marker hidden');
          hideMarker();
          
          // Notify parent that we're still waiting
          if (onEditingStateChange) {
            onEditingStateChange(true);
          }
        }
      };

      autocomplete.addEventListener('blur', handleBlur);

      // Store cleanup functions
      (autocomplete as any).__focusHandler = handleFocus;
      (autocomplete as any).__inputHandler = handleInput;
      (autocomplete as any).__blurHandler = handleBlur;

      console.log('[GoogleMapEmbed] ✅ All event listeners attached');

      mountedRef.current = true;
      onLoad();
    } catch (error) {
      console.error('[GoogleMapEmbed] ❌ Error initializing map:', error);
    }

    // Cleanup on unmount
    return () => {
      console.log('[GoogleMapEmbed] 🧹 Cleaning up map and autocomplete');
      
      if (autocompleteRef.current) {
        const focusHandler = (autocompleteRef.current as any).__focusHandler;
        const inputHandler = (autocompleteRef.current as any).__inputHandler;
        const blurHandler = (autocompleteRef.current as any).__blurHandler;
        
        if (focusHandler) {
          autocompleteRef.current.removeEventListener('focus', focusHandler);
        }
        if (inputHandler) {
          autocompleteRef.current.removeEventListener('input', inputHandler);
        }
        if (blurHandler) {
          autocompleteRef.current.removeEventListener('blur', blurHandler);
        }
      }
      
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
        className="w-full relative z-[9999]"
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
  onLocationChange,
  onInvalidLocation
}: LocationColumnProps) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(recognizedLocation || defaultLocation);
  
  // Track if user has selected a valid location (overrides error state)
  const [hasValidSelection, setHasValidSelection] = useState(!hasError);
  
  // Track invalid location state
  const [invalidLocationText, setInvalidLocationText] = useState<string | null>(
    hasError ? attemptedLocation : null
  );

  // Track display name and marker visibility for status message
  const [displayName, setDisplayName] = useState(defaultLocation.name);
  const [markerVisible, setMarkerVisible] = useState(true);
  
  // Track if user is currently editing (typing but hasn't selected)
  const [isEditing, setIsEditing] = useState(false);

  // Determine which location to show on the map
  const mapLocation = currentLocation;
  const showPlaceMarker = !!recognizedLocation;

  const handleLocationChange = (newLocation: { lat: number; lng: number; shortName: string; fullAddress: string }) => {
    console.log('[LocationColumn] 📍 Location changed');
    console.log('[LocationColumn] 📝 Short name:', newLocation.shortName);
    console.log('[LocationColumn] 📍 Full address:', newLocation.fullAddress);
    
    // Mark that user has selected a valid location (clears error state)
    setHasValidSelection(true);
    setInvalidLocationText(null);
    
    // Update display name and marker visibility
    setDisplayName(newLocation.shortName);
    setMarkerVisible(true);
    setIsEditing(false); // User has completed selection
    
    // Update map location
    setCurrentLocation({
      lat: newLocation.lat,
      lng: newLocation.lng,
      name: newLocation.fullAddress,
    });
    
    // Notify parent with full address for navigation
    onLocationChange({
      lat: newLocation.lat,
      lng: newLocation.lng,
      address: newLocation.fullAddress,
    });
  };

  const handleInvalidLocation = (attemptedText: string) => {
    console.log('[LocationColumn] ⚠️ Invalid location detected:', attemptedText);
    
    // Mark location as invalid
    setHasValidSelection(false);
    setInvalidLocationText(attemptedText);
    
    // Notify parent if callback provided
    if (onInvalidLocation) {
      onInvalidLocation(attemptedText);
    }
  };

  const handleEditingStateChange = (editing: boolean) => {
    console.log('[LocationColumn] ✏️ Editing state changed:', editing);
    setIsEditing(editing);
  };

  // Determine if we should show error message
  const showError = (hasError || !hasValidSelection) && invalidLocationText;

  return (
    <div className="flex-1 space-y-6">
      {/* Column Header */}
      <div className="text-center">
        <h2 className="text-2xl font-medium text-slate-800 mb-2">
          {title}
        </h2>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full" />
      </div>

      {/* Error Message - Only shown when there's an error */}
      {showError && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-sm">
          <p className="text-slate-600 text-sm font-light text-center break-words">
            <span className="text-red-500 font-medium">✗</span> Sorry, we couldn't find: <span className="font-medium text-slate-800">{invalidLocationText}</span>
          </p>
        </div>
      )}

      {/* Status Message - Positioned ABOVE the map section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="text-center">
          {isEditing ? (
            <p className="text-slate-500 text-sm font-light italic">
              Waiting for a location to be selected
            </p>
          ) : markerVisible ? (
            <p className="text-slate-600 text-sm font-light">
              <span className="text-green-600 font-medium">✓</span> Location recognised: <span className="font-medium text-slate-800">{displayName}</span>
            </p>
          ) : (
            <p className="text-slate-500 text-sm font-light italic">
              Waiting for a location to be selected
            </p>
          )}
        </div>
      </div>

      {/* Google Maps Section - Relative positioning for z-index context */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm relative z-10">
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
            onInvalidLocation={handleInvalidLocation}
            onEditingStateChange={handleEditingStateChange}
          />
        </div>
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
  
  // Track invalid location states
  const [sourceInvalid, setSourceInvalid] = useState(!!sourceError);
  const [destinationInvalid, setDestinationInvalid] = useState(!!destinationError);

  // Check if both locations are valid (button should be enabled)
  const isButtonEnabled = !sourceError && !destinationError && !sourceInvalid && !destinationInvalid;

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

    console.log('[LocationSearchPage] 🚀 Start Exploration clicked');
    console.log('[LocationSearchPage] 📍 Source:', sourceLocation);
    console.log('[LocationSearchPage] 📍 Destination:', destinationLocation);

    // Navigate to preparation phase with current locations and start flag
    const params = new URLSearchParams();
    params.set('src', `${sourceLocation.lat},${sourceLocation.lng}`);
    params.set('dst', `${destinationLocation.lat},${destinationLocation.lng}`);
    params.set('start', 'true'); // Flag to indicate user wants to start
    
    console.log('[LocationSearchPage] 🔄 Navigating to preparation phase with params:', params.toString());
    
    window.location.href = `/?${params.toString()}`;
  };

  const handleRouteClick = (route: typeof popularRoutes[0]) => {
    console.log('[LocationSearchPage] 🗺️ Popular route clicked:', route);
    
    // Navigate to preparation phase with preset route and start flag
    const params = new URLSearchParams();
    params.set('src', `${route.srcCoords.lat},${route.srcCoords.lng}`);
    params.set('dst', `${route.dstCoords.lat},${route.dstCoords.lng}`);
    params.set('start', 'true'); // Flag to indicate user wants to start
    
    console.log('[LocationSearchPage] 🔄 Navigating to preparation phase with params:', params.toString());
    
    window.location.href = `/?${params.toString()}`;
  };

  const handleSourceLocationChange = (loc: { lat: number; lng: number; address: string }) => {
    setSourceLocation({ name: loc.address, lat: loc.lat, lng: loc.lng });
    setSourceInvalid(false);
  };

  const handleDestinationLocationChange = (loc: { lat: number; lng: number; address: string }) => {
    setDestinationLocation({ name: loc.address, lat: loc.lat, lng: loc.lng });
    setDestinationInvalid(false);
  };

  const handleSourceInvalid = (attemptedText: string) => {
    console.log('[LocationSearchPage] ⚠️ Source location invalid:', attemptedText);
    setSourceInvalid(true);
  };

  const handleDestinationInvalid = (attemptedText: string) => {
    console.log('[LocationSearchPage] ⚠️ Destination location invalid:', attemptedText);
    setDestinationInvalid(true);
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
					<span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">You Are Here:</span>&nbsp; 
          {sourceError || destinationError || sourceInvalid || destinationInvalid ? (
            <>Let's Find <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Location</span></>
          ) : (
            <>Review Your Locations</>
          )}
        </h1>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Source Location Column */}
          <LocationColumn
            title="Starting Point"
            hasError={!!sourceError}
            attemptedLocation={sourceError?.attemptedLocation}
            recognizedLocation={!sourceError && srcParam ? undefined : undefined}
            paramName="src"
            defaultLocation={defaultSourceLocation}
            onLocationChange={handleSourceLocationChange}
            onInvalidLocation={handleSourceInvalid}
          />

          {/* Divider */}
          <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent flex-shrink-0" />

          {/* Destination Location Column */}
          <LocationColumn
            title="Destination"
            hasError={!!destinationError}
            attemptedLocation={destinationError?.attemptedLocation}
            recognizedLocation={!destinationError && dstParam ? undefined : undefined}
            paramName="dst"
            defaultLocation={defaultDestinationLocation}
            onLocationChange={handleDestinationLocationChange}
            onInvalidLocation={handleDestinationInvalid}
          />
        </div>

        {/* Start Exploration Button */}
        <button
          onClick={handleStartExploration}
          disabled={!isButtonEnabled}
          className={`w-full group relative overflow-hidden ${
            isButtonEnabled
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 cursor-pointer'
              : 'bg-gradient-to-r from-slate-300 to-slate-400 cursor-not-allowed'
          } text-white font-medium py-6 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform ${
            isButtonEnabled ? 'hover:scale-[1.01]' : ''
          } mb-12 relative z-0`}
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

        {/* Popular Routes */}
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
