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
  onSelectionStateChange?: (hasValidSelection: boolean) => void;
}

const GoogleMapEmbed = ({ 
  location, 
  title,
  onLoad,
  onLocationChange,
  onEditingStateChange
}: { 
  location: { lat: number; lng: number }; 
  title: string;
  onLoad: () => void;
  onLocationChange?: (location: { lat: number; lng: number; shortName: string; fullAddress: string }) => void;
  onEditingStateChange?: (isEditing: boolean) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const mountedRef = useRef(false);
  
  const committedPlaceRef = useRef<google.maps.places.Place | null>(null);
  const editedSinceFocusRef = useRef(false);
  const [markerVisible, setMarkerVisible] = useState(true);
  const [displayName, setDisplayName] = useState(title);
  const lastLocationRef = useRef({ lat: location.lat, lng: location.lng });

  useEffect(() => {
    if (!window.google?.maps || !containerRef.current || !autocompleteContainerRef.current) return;

    if (mountedRef.current) {
      if (mapInstanceRef.current && markerRef.current) {
        const locationChanged = 
          lastLocationRef.current.lat !== location.lat || 
          lastLocationRef.current.lng !== location.lng;
        
        if (locationChanged) {
          const newPos = { lat: location.lat, lng: location.lng };
          mapInstanceRef.current.setCenter(newPos);
          markerRef.current.setPosition(newPos);
          markerRef.current.setTitle(title);
          setDisplayName(title);
          lastLocationRef.current = { lat: location.lat, lng: location.lng };
        }
      }
      return;
    }

    try {
      const map = new google.maps.Map(containerRef.current, {
        center: { lat: location.lat, lng: location.lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;

      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: title,
        visible: true,
      });

      markerRef.current = marker;

      const autocomplete = new google.maps.places.PlaceAutocompleteElement();
      autocomplete.style.border = '1px solid black';
      autocomplete.style.position = 'relative';
      autocomplete.style.zIndex = '9999';
      autocompleteContainerRef.current.appendChild(autocomplete);
      autocompleteRef.current = autocomplete;

      const hideMarker = () => {
        if (markerRef.current) markerRef.current.setVisible(false);
        setMarkerVisible(false);
      };

      const showMarkerAt = (position: google.maps.LatLng, placeName: string, shortName: string) => {
        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setPosition(position);
          markerRef.current.setTitle(placeName);
          markerRef.current.setVisible(true);
          mapInstanceRef.current.setCenter(position);
          mapInstanceRef.current.setZoom(15);
          lastLocationRef.current = { lat: position.lat(), lng: position.lng() };
        }
        setMarkerVisible(true);
        setDisplayName(shortName);
      };

      const handleFocus = () => {
        editedSinceFocusRef.current = false;
      };

      autocomplete.addEventListener('focus', handleFocus);

      const handleInput = () => {
        if (!editedSinceFocusRef.current) {
          editedSinceFocusRef.current = true;
          hideMarker();
          onEditingStateChange?.(true);
        }
      };

      autocomplete.addEventListener('input', handleInput);

      autocomplete.addEventListener('gmp-select', async ({ placePrediction }: any) => {
        try {
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location']
          });

          if (!place.location) return;

          committedPlaceRef.current = place;
          editedSinceFocusRef.current = false;

          const newLocation = {
            lat: place.location.lat(),
            lng: place.location.lng(),
          };

          const shortName = place.displayName || place.formattedAddress || 'Unknown location';
          const fullAddress = place.formattedAddress || place.displayName || 'Unknown location';

          showMarkerAt(place.location, fullAddress, shortName);
          onEditingStateChange?.(false);
          onLocationChange?.({
            lat: newLocation.lat,
            lng: newLocation.lng,
            shortName: shortName,
            fullAddress: fullAddress,
          });
        } catch (error) {
          console.error('Error handling place selection:', error);
        }
      });

      const handleBlur = () => {
        if (!editedSinceFocusRef.current) return;
        
        if (committedPlaceRef.current?.location) {
          const lastPlace = committedPlaceRef.current;
          const shortName = lastPlace.displayName || lastPlace.formattedAddress || 'Unknown location';
          const fullAddress = lastPlace.formattedAddress || lastPlace.displayName || 'Unknown location';
          showMarkerAt(lastPlace.location, fullAddress, shortName);
          onEditingStateChange?.(false);
          onLocationChange?.({
            lat: lastPlace.location.lat(),
            lng: lastPlace.location.lng(),
            shortName: shortName,
            fullAddress: fullAddress,
          });
        } else {
          hideMarker();
          onEditingStateChange?.(true);
        }
      };

      autocomplete.addEventListener('blur', handleBlur);

      (autocomplete as any).__focusHandler = handleFocus;
      (autocomplete as any).__inputHandler = handleInput;
      (autocomplete as any).__blurHandler = handleBlur;

      mountedRef.current = true;
      onLoad();
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (autocompleteRef.current) {
        const focusHandler = (autocompleteRef.current as any).__focusHandler;
        const inputHandler = (autocompleteRef.current as any).__inputHandler;
        const blurHandler = (autocompleteRef.current as any).__blurHandler;
        
        if (focusHandler) autocompleteRef.current.removeEventListener('focus', focusHandler);
        if (inputHandler) autocompleteRef.current.removeEventListener('input', inputHandler);
        if (blurHandler) autocompleteRef.current.removeEventListener('blur', blurHandler);
      }
      
      if (autocompleteRef.current && autocompleteContainerRef.current) {
        try {
          autocompleteContainerRef.current.removeChild(autocompleteRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        autocompleteRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapInstanceRef.current = null;
      mountedRef.current = false;
    };
  }, [location.lat, location.lng, title]);

  return (
    <div className="space-y-3">
      <div 
        ref={containerRef}
        className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
      />
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
  onInvalidLocation,
  onSelectionStateChange
}: LocationColumnProps) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(recognizedLocation || defaultLocation);
  const [hasValidSelection, setHasValidSelection] = useState(!hasError);
  const [invalidLocationText, setInvalidLocationText] = useState<string | null>(
    hasError ? attemptedLocation : null
  );
  const [displayName, setDisplayName] = useState(defaultLocation.name);
  const [markerVisible, setMarkerVisible] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const isWaitingForSelection = isEditing || !markerVisible;
    onSelectionStateChange?.(!isWaitingForSelection);
  }, [isEditing, markerVisible, onSelectionStateChange]);

  const mapLocation = currentLocation;

  const handleLocationChange = (newLocation: { lat: number; lng: number; shortName: string; fullAddress: string }) => {
    setHasValidSelection(true);
    setInvalidLocationText(null);
    setDisplayName(newLocation.shortName);
    setMarkerVisible(true);
    setIsEditing(false);
    
    setCurrentLocation({
      lat: newLocation.lat,
      lng: newLocation.lng,
      name: newLocation.fullAddress,
    });
    
    onLocationChange({
      lat: newLocation.lat,
      lng: newLocation.lng,
      address: newLocation.fullAddress,
    });
  };

  const handleInvalidLocation = (attemptedText: string) => {
    setHasValidSelection(false);
    setInvalidLocationText(attemptedText);
    onInvalidLocation?.(attemptedText);
  };

  const handleEditingStateChange = (editing: boolean) => {
    setIsEditing(editing);
  };

  const showError = (hasError || !hasValidSelection) && invalidLocationText;

  return (
    <div className="flex-1 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-medium text-slate-800 mb-2">
          {title}
        </h2>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full" />
      </div>

      {showError && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-sm">
          <p className="text-slate-600 text-sm font-light text-center break-words">
            <span className="text-red-500 font-medium">✗</span> Sorry, we couldn't find: <span className="font-medium text-slate-800">{invalidLocationText}</span>
          </p>
        </div>
      )}

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

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm relative z-10">
        <p className="text-slate-700 text-sm font-medium mb-4">
          Search for a location:
        </p>
        
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
            title={defaultLocation.name}
            onLoad={() => setMapLoaded(true)}
            onLocationChange={handleLocationChange}
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

  const urlParams = new URLSearchParams(window.location.search);
  const srcParam = urlParams.get('src');
  const dstParam = urlParams.get('dst');

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

  const [sourceLocation, setSourceLocation] = useState(getInitialSourceLocation());
  const [destinationLocation, setDestinationLocation] = useState(getInitialDestinationLocation());
  const [sourceInvalid, setSourceInvalid] = useState(!!sourceError);
  const [destinationInvalid, setDestinationInvalid] = useState(!!destinationError);
  const [sourceHasValidSelection, setSourceHasValidSelection] = useState(true);
  const [destinationHasValidSelection, setDestinationHasValidSelection] = useState(true);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  const isButtonEnabled = 
    !sourceError && 
    !destinationError && 
    !sourceInvalid && 
    !destinationInvalid && 
    sourceHasValidSelection && 
    destinationHasValidSelection;

  useEffect(() => {
    const calculateDistance = async () => {
      if (!sourceLocation || !destinationLocation || !sourceHasValidSelection || !destinationHasValidSelection) {
        setRouteDistance(null);
        return;
      }

      setIsCalculatingDistance(true);

      try {
        const response = await fetch(
          `https://routes.googleapis.com/directions/v2:computeRoutes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: sourceLocation.lat,
                    longitude: sourceLocation.lng,
                  },
                },
              },
              destination: {
                location: {
                  latLng: {
                    latitude: destinationLocation.lat,
                    longitude: destinationLocation.lng,
                  },
                },
              },
              travelMode: 'WALK',
              routingPreference: 'ROUTING_PREFERENCE_UNSPECIFIED',
              computeAlternativeRoutes: false,
              routeModifiers: {
                avoidTolls: false,
                avoidHighways: false,
                avoidFerries: false,
              },
              languageCode: 'en-US',
              units: 'METRIC',
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Routes API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.routes?.[0]) {
          const distanceMeters = data.routes[0].distanceMeters;
          const formattedDistance = distanceMeters < 1000 
            ? `${Math.round(distanceMeters)}m`
            : `${(distanceMeters / 1000).toFixed(1)}km`;
          setRouteDistance(formattedDistance);
        } else {
          setRouteDistance(null);
        }
      } catch (error) {
        console.error('Error calculating distance:', error);
        setRouteDistance(null);
      } finally {
        setIsCalculatingDistance(false);
      }
    };

    calculateDistance();
  }, [sourceLocation, destinationLocation, sourceHasValidSelection, destinationHasValidSelection]);

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

    const params = new URLSearchParams();
    params.set('src', `${sourceLocation.lat},${sourceLocation.lng}`);
    params.set('dst', `${destinationLocation.lat},${destinationLocation.lng}`);
    params.set('start', 'true');
    
    window.location.href = `/?${params.toString()}`;
  };

  const handleRouteClick = (route: typeof popularRoutes[0]) => {
    const params = new URLSearchParams();
    params.set('src', `${route.srcCoords.lat},${route.srcCoords.lng}`);
    params.set('dst', `${route.dstCoords.lat},${route.dstCoords.lng}`);
    params.set('start', 'true');
    
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
    setSourceInvalid(true);
  };

  const handleDestinationInvalid = (attemptedText: string) => {
    setDestinationInvalid(true);
  };

  const handleSourceSelectionStateChange = (hasValidSelection: boolean) => {
    setSourceHasValidSelection(hasValidSelection);
  };

  const handleDestinationSelectionStateChange = (hasValidSelection: boolean) => {
    setDestinationHasValidSelection(hasValidSelection);
  };

  const getButtonText = () => {
    if (!isButtonEnabled) return 'Please Select Valid Locations';
    if (isCalculatingDistance) return 'Calculating Route...';
    if (routeDistance) return `Explore Your Selected ${routeDistance} Route`;
    return 'Start Your Exploration';
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8 w-full">
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

        <h1 className="text-5xl font-light tracking-tight text-slate-900 text-center mb-12">
					<span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">You Are Here:</span>&nbsp; 
          {sourceError || destinationError || sourceInvalid || destinationInvalid ? (
            <>Let's Find <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Location</span></>
          ) : (
            <>Review Your Locations</>
          )}
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          <LocationColumn
            title="Starting Point"
            hasError={!!sourceError}
            attemptedLocation={sourceError?.attemptedLocation}
            recognizedLocation={undefined}
            paramName="src"
            defaultLocation={defaultSourceLocation}
            onLocationChange={handleSourceLocationChange}
            onInvalidLocation={handleSourceInvalid}
            onSelectionStateChange={handleSourceSelectionStateChange}
          />

          <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent flex-shrink-0" />

          <LocationColumn
            title="Destination"
            hasError={!!destinationError}
            attemptedLocation={destinationError?.attemptedLocation}
            recognizedLocation={undefined}
            paramName="dst"
            defaultLocation={defaultDestinationLocation}
            onLocationChange={handleDestinationLocationChange}
            onInvalidLocation={handleDestinationInvalid}
            onSelectionStateChange={handleDestinationSelectionStateChange}
          />
        </div>

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
              {getButtonText()}
            </span>
            {isButtonEnabled && !isCalculatingDistance && (
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            )}
          </div>
        </button>

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
