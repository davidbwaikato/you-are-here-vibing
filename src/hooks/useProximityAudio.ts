import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { isUserInsideLocationCuboid } from '@/utils/proximityDetection';

interface AudioState {
  sourceAudio: HTMLAudioElement | null;
  destinationAudio: HTMLAudioElement | null;
  currentlyPlaying: 'source' | 'destination' | null;
  isSourceInside: boolean;
  isDestinationInside: boolean;
}

/**
 * Hook to manage proximity-based audio playback
 * Automatically plays audio when user enters location cuboids
 * Pauses audio when user exits location cuboids
 */
export const useProximityAudio = () => {
  const audioStateRef = useRef<AudioState>({
    sourceAudio: null,
    destinationAudio: null,
    currentlyPlaying: null,
    isSourceInside: false,
    isDestinationInside: false,
  });

  const [isAudioReady, setIsAudioReady] = useState(false);

  // Get data from Redux store
  const { 
    position, 
    sourceLocation, 
    destinationLocation,
    sourceDetails,
    destinationDetails,
    isLoaded: isStreetViewLoaded,
  } = useSelector((state: RootState) => state.streetView);

  // Initialize audio elements when audio URLs are available
  useEffect(() => {
    console.log('[ProximityAudio] 🎵 Checking audio initialization...', {
      hasSourceAudio: !!sourceDetails?.audioUrl,
      hasDestinationAudio: !!destinationDetails?.audioUrl,
      isStreetViewLoaded,
    });

    if (!isStreetViewLoaded) {
      console.log('[ProximityAudio] ⏸️ Street View not loaded yet, waiting...');
      return;
    }

    let sourceAudioElement: HTMLAudioElement | null = null;
    let destinationAudioElement: HTMLAudioElement | null = null;

    // Create source audio element
    if (sourceDetails?.audioUrl && !audioStateRef.current.sourceAudio) {
      console.log('[ProximityAudio] 🎵 Creating source audio element:', {
        filename: sourceDetails.audioFilename,
        url: sourceDetails.audioUrl.substring(0, 50) + '...',
      });

      sourceAudioElement = new Audio(sourceDetails.audioUrl);
      sourceAudioElement.preload = 'auto';
      
      sourceAudioElement.addEventListener('canplaythrough', () => {
        console.log('[ProximityAudio] ✅ Source audio ready to play');
        setIsAudioReady(true);
      });

      sourceAudioElement.addEventListener('error', (e) => {
        console.error('[ProximityAudio] ❌ Source audio error:', e);
      });

      audioStateRef.current.sourceAudio = sourceAudioElement;
    }

    // Create destination audio element
    if (destinationDetails?.audioUrl && !audioStateRef.current.destinationAudio) {
      console.log('[ProximityAudio] 🎵 Creating destination audio element:', {
        filename: destinationDetails.audioFilename,
        url: destinationDetails.audioUrl.substring(0, 50) + '...',
      });

      destinationAudioElement = new Audio(destinationDetails.audioUrl);
      destinationAudioElement.preload = 'auto';
      
      destinationAudioElement.addEventListener('canplaythrough', () => {
        console.log('[ProximityAudio] ✅ Destination audio ready to play');
        setIsAudioReady(true);
      });

      destinationAudioElement.addEventListener('error', (e) => {
        console.error('[ProximityAudio] ❌ Destination audio error:', e);
      });

      audioStateRef.current.destinationAudio = destinationAudioElement;
    }

    // Cleanup function
    return () => {
      if (sourceAudioElement) {
        console.log('[ProximityAudio] 🧹 Cleaning up source audio element');
        sourceAudioElement.pause();
        sourceAudioElement.src = '';
      }
      if (destinationAudioElement) {
        console.log('[ProximityAudio] 🧹 Cleaning up destination audio element');
        destinationAudioElement.pause();
        destinationAudioElement.src = '';
      }
    };
  }, [sourceDetails?.audioUrl, destinationDetails?.audioUrl, isStreetViewLoaded]);

  // Handle proximity detection and audio playback
  useEffect(() => {
    if (!isStreetViewLoaded || !isAudioReady) {
      console.log('[ProximityAudio] ⏸️ Not ready for proximity detection:', {
        isStreetViewLoaded,
        isAudioReady,
      });
      return;
    }

    console.log('[ProximityAudio] 🔍 Checking proximity...', {
      userPosition: position,
      sourceLocation,
      destinationLocation,
    });

    // Check if user is inside source location cuboid
    const isInsideSource = sourceLocation 
      ? isUserInsideLocationCuboid(position, sourceLocation)
      : false;

    // Check if user is inside destination location cuboid
    const isInsideDestination = destinationLocation
      ? isUserInsideLocationCuboid(position, destinationLocation)
      : false;

    console.log('[ProximityAudio] 📍 Proximity check results:', {
      isInsideSource,
      isInsideDestination,
      previousSourceInside: audioStateRef.current.isSourceInside,
      previousDestinationInside: audioStateRef.current.isDestinationInside,
      currentlyPlaying: audioStateRef.current.currentlyPlaying,
    });

    // Handle source location audio
    if (isInsideSource !== audioStateRef.current.isSourceInside) {
      console.log('[ProximityAudio] 🔄 Source proximity changed:', {
        wasInside: audioStateRef.current.isSourceInside,
        nowInside: isInsideSource,
      });

      audioStateRef.current.isSourceInside = isInsideSource;

      if (isInsideSource && audioStateRef.current.sourceAudio) {
        // Entered source location - play source audio
        console.log('[ProximityAudio] ▶️ Playing source audio');
        
        // Pause destination audio if playing
        if (audioStateRef.current.destinationAudio && !audioStateRef.current.destinationAudio.paused) {
          console.log('[ProximityAudio] ⏸️ Pausing destination audio');
          audioStateRef.current.destinationAudio.pause();
        }

        // Play source audio
        audioStateRef.current.sourceAudio.play().catch((error) => {
          console.error('[ProximityAudio] ❌ Failed to play source audio:', error);
        });
        audioStateRef.current.currentlyPlaying = 'source';
      } else if (!isInsideSource && audioStateRef.current.sourceAudio && audioStateRef.current.currentlyPlaying === 'source') {
        // Exited source location - pause source audio
        console.log('[ProximityAudio] ⏸️ Pausing source audio (exited cuboid)');
        audioStateRef.current.sourceAudio.pause();
        audioStateRef.current.currentlyPlaying = null;
      }
    }

    // Handle destination location audio
    if (isInsideDestination !== audioStateRef.current.isDestinationInside) {
      console.log('[ProximityAudio] 🔄 Destination proximity changed:', {
        wasInside: audioStateRef.current.isDestinationInside,
        nowInside: isInsideDestination,
      });

      audioStateRef.current.isDestinationInside = isInsideDestination;

      if (isInsideDestination && audioStateRef.current.destinationAudio) {
        // Entered destination location - play destination audio
        console.log('[ProximityAudio] ▶️ Playing destination audio');
        
        // Pause source audio if playing
        if (audioStateRef.current.sourceAudio && !audioStateRef.current.sourceAudio.paused) {
          console.log('[ProximityAudio] ⏸️ Pausing source audio');
          audioStateRef.current.sourceAudio.pause();
        }

        // Play destination audio
        audioStateRef.current.destinationAudio.play().catch((error) => {
          console.error('[ProximityAudio] ❌ Failed to play destination audio:', error);
        });
        audioStateRef.current.currentlyPlaying = 'destination';
      } else if (!isInsideDestination && audioStateRef.current.destinationAudio && audioStateRef.current.currentlyPlaying === 'destination') {
        // Exited destination location - pause destination audio
        console.log('[ProximityAudio] ⏸️ Pausing destination audio (exited cuboid)');
        audioStateRef.current.destinationAudio.pause();
        audioStateRef.current.currentlyPlaying = null;
      }
    }

  }, [position, sourceLocation, destinationLocation, isStreetViewLoaded, isAudioReady]);

  return {
    isAudioReady,
    isInsideSource: audioStateRef.current.isSourceInside,
    isInsideDestination: audioStateRef.current.isDestinationInside,
    currentlyPlaying: audioStateRef.current.currentlyPlaying,
  };
};
