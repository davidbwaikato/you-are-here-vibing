import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { MapPin } from 'lucide-react';

export const LocationOverlay = () => {
  const { currentLocation } = useSelector((state: RootState) => state.streetView);

  if (!currentLocation) return null;

  return (
    <div 
      className="z-50 pointer-events-none"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px'
      }}
    >
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-sm pointer-events-auto">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
              <MapPin className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Current
            </div>
            <div className="text-sm font-light text-slate-900 break-words leading-relaxed">
              {currentLocation}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
