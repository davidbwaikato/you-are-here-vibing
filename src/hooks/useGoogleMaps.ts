import { useEffect, useState } from 'react';

// Global flag to track if the API is already loaded or loading
let isLoadingGoogleMaps = false;
let isGoogleMapsLoaded = false;

export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    // If already loaded, just update state
    if (window.google && window.google.maps) {
      console.log('[useGoogleMaps] Google Maps already loaded');
      isGoogleMapsLoaded = true;
      setIsLoaded(true);
      return;
    }

    // If currently loading, wait for it
    if (isLoadingGoogleMaps) {
      console.log('[useGoogleMaps] Google Maps currently loading, waiting...');
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          console.log('[useGoogleMaps] Google Maps loaded (from waiting)');
          isGoogleMapsLoaded = true;
          setIsLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      console.error('[useGoogleMaps] Google Maps API key not configured');
      setLoadError(new Error('Google Maps API key not configured'));
      return;
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (existingScript) {
      console.log('[useGoogleMaps] Script exists in DOM, waiting for load...');
      // Script exists, wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google && window.google.maps) {
          console.log('[useGoogleMaps] Google Maps loaded (from existing script)');
          isGoogleMapsLoaded = true;
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);

      return () => clearInterval(checkLoaded);
    }

    // Mark as loading
    console.log('[useGoogleMaps] Starting to load Google Maps API...');
    isLoadingGoogleMaps = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('[useGoogleMaps] Google Maps API loaded successfully');
      isGoogleMapsLoaded = true;
      isLoadingGoogleMaps = false;
      setIsLoaded(true);
    };

    script.onerror = () => {
      console.error('[useGoogleMaps] Failed to load Google Maps API');
      isLoadingGoogleMaps = false;
      setLoadError(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script on unmount as other components may need it
      // The script should persist for the lifetime of the application
    };
  }, []);

  return { isLoaded, loadError };
};
