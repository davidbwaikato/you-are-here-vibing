import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { MapPin, Navigation } from 'lucide-react';

export const LocationOverlay = () => {
  const { sourceAddress, destinationAddress } = useSelector((state: RootState) => state.streetView);

  return (
    <>
      {/* Current Location - Bottom Left */}
      {sourceAddress && (
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
                <span className="font-medium">Current:</span> {sourceAddress}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Destination Location - Bottom Right */}
      {destinationAddress && (
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
                <span className="font-medium">Destination:</span> {destinationAddress}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
