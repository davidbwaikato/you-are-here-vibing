import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    console.log('[SplashScreen] 💫 Splash screen mounted');
    
    return () => {
      console.log('[SplashScreen] 👋 Splash screen unmounting');
    };
  }, []);

  // Fade out when parent decides to unmount
  useEffect(() => {
    if (!isVisible) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  return (
    <div
      className="fixed inset-0 bg-white z-50 flex items-center justify-center"
      style={{ zIndex: 9999 }}
    >
      <div className="flex flex-col items-center gap-8 px-4">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl rounded-full" />
          <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-2xl shadow-2xl">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
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

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
};
