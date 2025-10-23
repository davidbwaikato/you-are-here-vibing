import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { isUserInsideLocationCuboid } from '@/utils/proximityDetection';

interface AudioState {
  sourceAudio: HTMLAudioElement | null;
  destinationAudio: HTMLAudioElement | null;
  currentlyPlaying: 'source' | 'destination' | null;
  isSourceInside: boolean;
  isDestinationInside: boolean;
  manualControl: {
    source: boolean; // true if user manually paused source
    destination: boolean; // true if user manually paused destination
  };
}

/**
 * Hook to manage proximity-based and keyboard-based audio playback
 * Automatically plays audio when user enters location cuboids
 * Pauses audio when user exits location cuboids
 * Keyboard controls: 'S' for source, 'D' for destination (toggle play/pause)
 */
export const useProximityAudio = () => {
  const audioStateRef = useRef<AudioState>({
    sourceAudio: null,
    destinationAudio: null,
    currentlyPlaying: null,
    isSourceInside: false,
    isDestinationInside: false,
    manualControl: {
      source: false,
      destination: false,
    },
  });

  const [isAudioReady, setIsAudioReady] = useState(false);
  const [keyboardControlActive, setKeyboardControlActive] = useState<'source' | 'destination' | null>(null);

  // Get data from Redux store
  const { 
    position, 
    sourceLocation, 
    destinationLocation,
    sourceDetails,
    destinationDetails,
    isLoaded: isStreetViewLoaded,
  } = useSelector((state: RootState) => state.streetView);

  // Toggle source audio playback (keyboard control)
  const toggleSourceAudio = useCallback(() => {
    const audio = audioStateRef.current.sourceAudio;
    if (!audio) {
      console.log('[ProximityAudio] ⚠️ Source audio not available');
      return;
    }

    console.log('[ProximityAudio] ⌨️ Keyboard: Toggle source audio');

    if (audio.paused) {
      // Play source audio
      console.log('[ProximityAudio] ▶️ Keyboard: Playing source audio');
      
      // Pause destination audio if playing
      if (audioStateRef.current.destinationAudio && !audioStateRef.current.destinationAudio.paused) {
        console.log('[ProximityAudio] ⏸️ Keyboard: Pausing destination audio');
        audioStateRef.current.destinationAudio.pause();
        audioStateRef.current.manualControl.destination = true;
      }

      audio.play().catch((error) => {
        console.error('[ProximityAudio] ❌ Failed to play source audio:', error);
      });
      audioStateRef.current.currentlyPlaying = 'source';
      audioStateRef.current.manualControl.source = false;
      setKeyboardControlActive('source');
    } else {
      // Pause source audio
      console.log('[ProximityAudio] ⏸️ Keyboard: Pausing source audio');
      audio.pause();
      audioStateRef.current.currentlyPlaying = null;
      audioStateRef.current.manualControl.source = true;
      setKeyboardControlActive(null);
    }
  }, []);

  // Toggle destination audio playback (keyboard control)
  const toggleDestinationAudio = useCallback(() => {
    const audio = audioStateRef.current.destinationAudio;
    if (!audio) {
      console.log('[ProximityAudio] ⚠️ Destination audio not available');
      return;
    }

    console.log('[ProximityAudio] ⌨️ Keyboard: Toggle destination audio');

    if (audio.paused) {
      // Play destination audio
      console.log('[ProximityAudio] ▶️ Keyboard: Playing destination audio');
      
      // Pause source audio if playing
      if (audioStateRef.current.sourceAudio && !audioStateRef.current.sourceAudio.paused) {
        console.log('[ProximityAudio] ⏸️ Keyboard: Pausing source audio');
        audioStateRef.current.sourceAudio.pause();
        audioStateRef.current.manualControl.source = true;
      }

      audio.play().catch((error) => {
        console.error('[ProximityAudio] ❌ Failed to play destination audio:', error);
      });
      audioStateRef.current.currentlyPlaying = 'destination';
      audioStateRef.current.manualControl.destination = false;
      setKeyboardControlActive('destination');
    } else {
      // Pause destination audio
      console.log('[ProximityAudio] ⏸️ Keyboard: Pausing destination audio');
      audio.pause();
      audioStateRef.current.currentlyPlaying = null;
      audioStateRef.current.manualControl.destination = true;
      setKeyboardControlActive(null);
    }
  }, []);

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

  // Handle keyboard events
  useEffect(() => {
    if (!isAudioReady) {
      console.log('[ProximityAudio] ⏸️ Audio not ready for keyboard controls');
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 's') {
        console.log('[ProximityAudio] ⌨️ Key pressed: S (source audio)');
        event.preventDefault();
        toggleSourceAudio();
      } else if (key === 'd') {
        console.log('[ProximityAudio] ⌨️ Key pressed: D (destination audio)');
        event.preventDefault();
        toggleDestinationAudio();
      }
    };

    console.log('[ProximityAudio] ⌨️ Adding keyboard event listeners');
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      console.log('[ProximityAudio] ⌨️ Removing keyboard event listeners');
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isAudioReady, toggleSourceAudio, toggleDestinationAudio]);

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
      manualControl: audioStateRef.current.manualControl,
    });

    // Handle source location audio (only if not manually controlled)
    if (isInsideSource !== audioStateRef.current.isSourceInside) {
      console.log('[ProximityAudio] 🔄 Source proximity changed:', {
        wasInside: audioStateRef.current.isSourceInside,
        nowInside: isInsideSource,
        manuallyPaused: audioStateRef.current.manualControl.source,
      });

      audioStateRef.current.isSourceInside = isInsideSource;

      if (isInsideSource && audioStateRef.current.sourceAudio && !audioStateRef.current.manualControl.source) {
        // Entered source location - play source audio (if not manually paused)
        console.log('[ProximityAudio] ▶️ Proximity: Playing source audio');
        
        // Pause destination audio if playing
        if (audioStateRef.current.destinationAudio && !audioStateRef.current.destinationAudio.paused) {
          console.log('[ProximityAudio] ⏸️ Proximity: Pausing destination audio');
          audioStateRef.current.destinationAudio.pause();
        }

        // Play source audio
        audioStateRef.current.sourceAudio.play().catch((error) => {
          console.error('[ProximityAudio] ❌ Failed to play source audio:', error);
        });
        audioStateRef.current.currentlyPlaying = 'source';
        setKeyboardControlActive(null);
      } else if (!isInsideSource && audioStateRef.current.sourceAudio && audioStateRef.current.currentlyPlaying === 'source') {
        // Exited source location - pause source audio (and reset manual control)
        console.log('[ProximityAudio] ⏸️ Proximity: Pausing source audio (exited cuboid)');
        audioStateRef.current.sourceAudio.pause();
        audioStateRef.current.currentlyPlaying = null;
        audioStateRef.current.manualControl.source = false;
        setKeyboardControlActive(null);
      }
    }

    // Handle destination location audio (only if not manually controlled)
    if (isInsideDestination !== audioStateRef.current.isDestinationInside) {
      console.log('[ProximityAudio] 🔄 Destination proximity changed:', {
        wasInside: audioStateRef.current.isDestinationInside,
        nowInside: isInsideDestination,
        manuallyPaused: audioStateRef.current.manualControl.destination,
      });

      audioStateRef.current.isDestinationInside = isInsideDestination;

      if (isInsideDestination && audioStateRef.current.destinationAudio && !audioStateRef.current.manualControl.destination) {
        // Entered destination location - play destination audio (if not manually paused)
        console.log('[ProximityAudio] ▶️ Proximity: Playing destination audio');
        
        // Pause source audio if playing
        if (audioStateRef.current.sourceAudio && !audioStateRef.current.sourceAudio.paused) {
          console.log('[ProximityAudio] ⏸️ Proximity: Pausing source audio');
          audioStateRef.current.sourceAudio.pause();
        }

        // Play destination audio
        audioStateRef.current.destinationAudio.play().catch((error) => {
          console.error('[ProximityAudio] ❌ Failed to play destination audio:', error);
        });
        audioStateRef.current.currentlyPlaying = 'destination';
        setKeyboardControlActive(null);
      } else if (!isInsideDestination && audioStateRef.current.destinationAudio && audioStateRef.current.currentlyPlaying === 'destination') {
        // Exited destination location - pause destination audio (and reset manual control)
        console.log('[ProximityAudio] ⏸️ Proximity: Pausing destination audio (exited cuboid)');
        audioStateRef.current.destinationAudio.pause();
        audioStateRef.current.currentlyPlaying = null;
        audioStateRef.current.manualControl.destination = false;
        setKeyboardControlActive(null);
      }
    }

  }, [position, sourceLocation, destinationLocation, isStreetViewLoaded, isAudioReady]);

  return {
    isAudioReady,
    isInsideSource: audioStateRef.current.isSourceInside,
    isInsideDestination: audioStateRef.current.isDestinationInside,
    currentlyPlaying: audioStateRef.current.currentlyPlaying,
    keyboardControlActive,
    toggleSourceAudio,
    toggleDestinationAudio,
  };
};
