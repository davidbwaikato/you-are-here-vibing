import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface SplashScreenProps {
  isLoading: boolean;
  onTransitionComplete: () => void;
}

export const SplashScreen = ({ isLoading, onTransitionComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Wait a moment before starting fade out
      const timer = setTimeout(() => {
        setFadeOut(true);
        // Complete transition after fade animation
        setTimeout(onTransitionComplete, 1000);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, onTransitionComplete]);

  return (
    <div
      className={`fixed inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-1000 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-8 px-4">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl rounded-full" />
          <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-2xl shadow-2xl">
            <MapPin className="w-16 h-16 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-6xl font-light tracking-tight text-slate-900">
            You Are <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Here</span>
          </h1>
          <p className="text-lg text-slate-500 font-light tracking-wide">
            Explore the world through Street View
          </p>
        </div>

        {/* Loading indicator - always visible to prevent layout shift */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="flex gap-2">
            <div className={`w-2 h-2 bg-blue-600 rounded-full ${isLoading ? 'animate-bounce [animation-delay:-0.3s]' : ''}`} />
            <div className={`w-2 h-2 bg-purple-600 rounded-full ${isLoading ? 'animate-bounce [animation-delay:-0.15s]' : ''}`} />
            <div className={`w-2 h-2 bg-blue-600 rounded-full ${isLoading ? 'animate-bounce' : ''}`} />
          </div>
          <p className="text-sm text-slate-400 font-light">Loading your destination...</p>
        </div>
      </div>
    </div>
  );
};
