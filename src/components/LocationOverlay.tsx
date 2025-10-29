import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { MapPin, Navigation } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Format distance in appropriate units (meters or kilometers)
 */
const formatDistance = (distanceMeters: number): string => {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)}km`;
};

/**
 * Calculate distance between two LatLng points using Haversine formula
 */
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

export const LocationOverlay = () => {
  const { 
    currentShortName, 
    destinationShortName,
    position,
    destinationLocation 
  } = useSelector((state: RootState) => state.streetView);

  // Calculate distance from current position to destination
  const distanceText = useMemo(() => {
    if (!destinationLocation) {
      return null;
    }

    const distance = calculateDistance(
      position.lat,
      position.lng,
      destinationLocation.lat,
      destinationLocation.lng
    );

    return formatDistance(distance);
  }, [position, destinationLocation]);

  console.log('[LocationOverlay] 📍 Rendering with:', {
    currentShortName,
    destinationShortName,
    distanceText,
  });

  return (
    <>
      {/* Current Location - Bottom Left */}
      {currentShortName && (
        <div 
          className="z-50 pointer-events-none"
          style={{
            position: 'fixed',
            bottom: '4px',
            left: '24px'
          }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 px-3 py-2 pointer-events-auto" style={{ maxWidth: 'fit-content' }}>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <div className="flex-shrink-0">
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-1.5 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div className="text-sm font-light text-slate-900">
                <span className="font-medium">Current:</span> {currentShortName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Destination Location - Bottom Right */}
      {destinationShortName && (
        <div 
          className="z-50 pointer-events-none"
          style={{
            position: 'fixed',
            bottom: '4px',
            right: '24px'
          }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 px-3 py-2 pointer-events-auto" style={{ maxWidth: 'fit-content' }}>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <div className="flex-shrink-0">
                <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-1.5 rounded-lg">
                  <Navigation className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div className="text-sm font-light text-slate-900">
                <span className="font-medium">Destination:</span> {destinationShortName}
                {distanceText && (
                  <span className="ml-1 text-slate-600">({distanceText})</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
