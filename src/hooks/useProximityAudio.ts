import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

// Debug flag to control console logging
const DEBUG_PROXIMITY_AUDIO = false;

// Proximity detection threshold (in meters)
const PROXIMITY_THRESHOLD = 15;

interface AudioState {
  sourceAudio: HTMLAudioElement | null;
  destinationAudio: HTMLAudioElement | null;
  currentlyPlaying: 'source' | 'destination' | null;
  isSourceInside: boolean;
  isDestinationInside: boolean;
  wasManuallyPaused: boolean; // Track if user manually paused
}

/**
 * Calculate geographic distance between two lat/lng points using Haversine formula
 */
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Hook to manage proximity-based and keyboard-based audio playback
 * Automatically plays audio when user enters location cuboids
 * Pauses audio when user exits location cuboids
 * Keyboard controls: 'I' for source, 'O' for destination (toggle play/pause)
 */
export const useProximityAudio = () => {
  if (DEBUG_PROXIMITY_AUDIO) {
    console.log('[ProximityAudio] 🚀 HOOK INITIALIZED - useProximityAudio called');
  }

  const audioStateRef = useRef<AudioState>({
    sourceAudio: null,
    destinationAudio: null,
    currentlyPlaying: null,
    isSourceInside: false,
    isDestinationInside: false,
    wasManuallyPaused: false,
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

  // Debug: Log Redux state changes
  useEffect(() => {
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 📊 Redux state update:', {
        isStreetViewLoaded,
        hasSourceDetails: !!sourceDetails,
        hasDestinationDetails: !!destinationDetails,
        hasSourceAudio: !!sourceDetails?.audioUrl,
        hasDestinationAudio: !!destinationDetails?.audioUrl,
        sourceAudioUrl: sourceDetails?.audioUrl?.substring(0, 50),
        destinationAudioUrl: destinationDetails?.audioUrl?.substring(0, 50),
      });
    }
  }, [isStreetViewLoaded, sourceDetails, destinationDetails]);

  // Toggle source audio playback (keyboard control)
  const toggleSourceAudio = useCallback(() => {
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎹 toggleSourceAudio FUNCTION CALLED');
    }
    const audio = audioStateRef.current.sourceAudio;
    if (!audio) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⚠️ Source audio not available');
      }
      return;
    }

    const isInside = audioStateRef.current.isSourceInside;

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎹 KEYBOARD CONTROL: Toggle source audio requested', {
        isInside,
        paused: audio.paused,
        currentlyPlaying: audioStateRef.current.currentlyPlaying,
        wasManuallyPaused: audioStateRef.current.wasManuallyPaused,
      });
    }

    if (audio.paused) {
      // Play source audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Source audio (keyboard)');
      }
      
      // Pause destination audio if playing
      if (audioStateRef.current.destinationAudio && !audioStateRef.current.destinationAudio.paused) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Destination audio (to play source)');
        }
        audioStateRef.current.destinationAudio.pause();
      }

      audio.play()
        .then(() => {
          if (DEBUG_PROXIMITY_AUDIO) {
            console.log('[ProximityAudio] ✅ PLAYBACK STARTED: Source audio playing successfully');
          }
        })
        .catch((error) => {
          console.error('[ProximityAudio] ❌ PLAYBACK FAILED: Source audio error:', error);
        });
      
      audioStateRef.current.currentlyPlaying = 'source';
      audioStateRef.current.wasManuallyPaused = false;
      setKeyboardControlActive('source');
    } else {
      // Pause source audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Source audio (keyboard)');
      }
      audio.pause();
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ✅ PLAYBACK PAUSED: Source audio paused successfully');
      }
      
      audioStateRef.current.currentlyPlaying = null;
      audioStateRef.current.wasManuallyPaused = true;
      setKeyboardControlActive(null);
    }
  }, []);

  // Toggle destination audio playback (keyboard control)
  const toggleDestinationAudio = useCallback(() => {
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎹 toggleDestinationAudio FUNCTION CALLED');
    }
    const audio = audioStateRef.current.destinationAudio;
    if (!audio) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⚠️ Destination audio not available');
      }
      return;
    }

    const isInside = audioStateRef.current.isDestinationInside;

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎹 KEYBOARD CONTROL: Toggle destination audio requested', {
        isInside,
        paused: audio.paused,
        currentlyPlaying: audioStateRef.current.currentlyPlaying,
        wasManuallyPaused: audioStateRef.current.wasManuallyPaused,
      });
    }

    if (audio.paused) {
      // Play destination audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Destination audio (keyboard)');
      }
      
      // Pause source audio if playing
      if (audioStateRef.current.sourceAudio && !audioStateRef.current.sourceAudio.paused) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Source audio (to play destination)');
        }
        audioStateRef.current.sourceAudio.pause();
      }

      audio.play()
        .then(() => {
          if (DEBUG_PROXIMITY_AUDIO) {
            console.log('[ProximityAudio] ✅ PLAYBACK STARTED: Destination audio playing successfully');
          }
        })
        .catch((error) => {
          console.error('[ProximityAudio] ❌ PLAYBACK FAILED: Destination audio error:', error);
        });
      
      audioStateRef.current.currentlyPlaying = 'destination';
      audioStateRef.current.wasManuallyPaused = false;
      setKeyboardControlActive('destination');
    } else {
      // Pause destination audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Destination audio (keyboard)');
      }
      audio.pause();
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ✅ PLAYBACK PAUSED: Destination audio paused successfully');
      }
      
      audioStateRef.current.currentlyPlaying = null;
      audioStateRef.current.wasManuallyPaused = true;
      setKeyboardControlActive(null);
    }
  }, []);

  // Initialize audio elements when audio URLs are available
  useEffect(() => {
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎵 Audio initialization effect running...', {
        hasSourceAudio: !!sourceDetails?.audioUrl,
        hasDestinationAudio: !!destinationDetails?.audioUrl,
        currentSourceAudio: !!audioStateRef.current.sourceAudio,
        currentDestinationAudio: !!audioStateRef.current.destinationAudio,
        sourceAudioUrl: sourceDetails?.audioUrl?.substring(0, 50),
        destinationAudioUrl: destinationDetails?.audioUrl?.substring(0, 50),
      });
    }

    // Check if we have audio data
    const hasAudioData = sourceDetails?.audioUrl || destinationDetails?.audioUrl;
    if (!hasAudioData) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ No audio data available yet, waiting...');
      }
      return;
    }

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] ✅ Audio data available, checking if initialization needed...');
    }

    let sourceAudioReady = false;
    let destinationAudioReady = false;

    const checkIfBothReady = () => {
      const sourceNeeded = !!sourceDetails?.audioUrl;
      const destNeeded = !!destinationDetails?.audioUrl;
      
      const sourceOk = !sourceNeeded || sourceAudioReady;
      const destOk = !destNeeded || destinationAudioReady;
      
      if (sourceOk && destOk) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ✅ All audio elements ready, enabling keyboard controls');
        }
        setIsAudioReady(true);
      }
    };

    // Create source audio element if needed
    if (sourceDetails?.audioUrl && !audioStateRef.current.sourceAudio) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] 🎵 Creating source audio element:', {
          filename: sourceDetails.audioFilename,
          url: sourceDetails.audioUrl.substring(0, 50) + '...',
        });
      }

      const sourceAudioElement = new Audio();
      sourceAudioElement.preload = 'auto';
      sourceAudioElement.src = sourceDetails.audioUrl;
      
      sourceAudioElement.addEventListener('canplaythrough', () => {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ✅ Source audio ready to play');
        }
        sourceAudioReady = true;
        checkIfBothReady();
      });

      sourceAudioElement.addEventListener('error', (e) => {
        console.error('[ProximityAudio] ❌ Source audio error:', e);
        console.error('[ProximityAudio] 🔍 Audio element details:', {
          src: sourceAudioElement?.src,
          readyState: sourceAudioElement?.readyState,
          networkState: sourceAudioElement?.networkState,
          error: sourceAudioElement?.error,
        });
      });

      sourceAudioElement.load();
      audioStateRef.current.sourceAudio = sourceAudioElement;
    } else if (audioStateRef.current.sourceAudio) {
      sourceAudioReady = true;
    }

    // Create destination audio element if needed
    if (destinationDetails?.audioUrl && !audioStateRef.current.destinationAudio) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] 🎵 Creating destination audio element:', {
          filename: destinationDetails.audioFilename,
          url: destinationDetails.audioUrl.substring(0, 50) + '...',
        });
      }

      const destinationAudioElement = new Audio();
      destinationAudioElement.preload = 'auto';
      destinationAudioElement.src = destinationDetails.audioUrl;
      
      destinationAudioElement.addEventListener('canplaythrough', () => {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ✅ Destination audio ready to play');
        }
        destinationAudioReady = true;
        checkIfBothReady();
      });

      destinationAudioElement.addEventListener('error', (e) => {
        console.error('[ProximityAudio] ❌ Destination audio error:', e);
        console.error('[ProximityAudio] 🔍 Audio element details:', {
          src: destinationAudioElement?.src,
          readyState: destinationAudioElement?.readyState,
          networkState: destinationAudioElement?.networkState,
          error: destinationAudioElement?.error,
        });
      });

      destinationAudioElement.load();
      audioStateRef.current.destinationAudio = destinationAudioElement;
    } else if (audioStateRef.current.destinationAudio) {
      destinationAudioReady = true;
    }

    // Check if already ready
    checkIfBothReady();
  }, [sourceDetails?.audioUrl, destinationDetails?.audioUrl]);

  // Handle keyboard events
  useEffect(() => {
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] ⌨️ Keyboard effect running...', {
        isAudioReady,
        hasToggleSourceAudio: !!toggleSourceAudio,
        hasToggleDestinationAudio: !!toggleDestinationAudio,
      });
    }

    if (!isAudioReady) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ Audio not ready for keyboard controls - SKIPPING listener setup');
      }
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] 🎹 ===== KEY PRESS EVENT FIRED =====');
        console.log('[ProximityAudio] 🎹 Raw event:', {
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          which: event.which,
          type: event.type,
          target: event.target,
          targetTagName: (event.target as HTMLElement)?.tagName,
        });
      }

      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏭️ Key press ignored - user typing in input field');
        }
        return;
      }

      const key = event.key.toLowerCase();
      
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] 🎹 KEY DETECTED:', {
          key: event.key,
          keyLowerCase: key,
          code: event.code,
          target: event.target,
        });
      }

      if (key === 'i') {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🎹 KEY MATCHED: "I" pressed - Source audio control');
        }
        event.preventDefault();
        toggleSourceAudio();
      } else if (key === 'o') {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🎹 KEY MATCHED: "O" pressed - Destination audio control');
        }
        event.preventDefault();
        toggleDestinationAudio();
      } else {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏭️ Key not mapped to audio control:', key);
        }
      }
    };

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] ⌨️ ATTACHING keyboard event listener to window');
    }
    window.addEventListener('keydown', handleKeyPress);
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] ✅ Keyboard event listener ATTACHED (I = source, O = destination)');
      console.log('[ProximityAudio] 🧪 Testing handler function exists:', typeof handleKeyPress);
    }

    return () => {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⌨️ REMOVING keyboard event listener from window');
      }
      window.removeEventListener('keydown', handleKeyPress);
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ✅ Keyboard event listener REMOVED');
      }
    };
  }, [isAudioReady, toggleSourceAudio, toggleDestinationAudio]);

  // Handle proximity detection and audio playback with pause/resume
  useEffect(() => {
    if (!isStreetViewLoaded || !isAudioReady) {
      return;
    }

    // Check if user is inside source location cuboid
    const isInsideSource = sourceLocation 
      ? calculateDistance(position.lat, position.lng, sourceLocation.lat, sourceLocation.lng) <= PROXIMITY_THRESHOLD
      : false;

    // Check if user is inside destination location cuboid
    const isInsideDestination = destinationLocation
      ? calculateDistance(position.lat, position.lng, destinationLocation.lat, destinationLocation.lng) <= PROXIMITY_THRESHOLD
      : false;

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 📏 Proximity check:', {
        isInsideSource,
        isInsideDestination,
        wasInsideSource: audioStateRef.current.isSourceInside,
        wasInsideDestination: audioStateRef.current.isDestinationInside,
        currentlyPlaying: audioStateRef.current.currentlyPlaying,
        wasManuallyPaused: audioStateRef.current.wasManuallyPaused,
      });
    }

    // Handle source location audio
    if (isInsideSource !== audioStateRef.current.isSourceInside) {
      audioStateRef.current.isSourceInside = isInsideSource;

      if (isInsideSource && audioStateRef.current.sourceAudio) {
        // Entering source cuboid
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🚪 ENTERED source cuboid');
        }

        // Only auto-play if not manually paused
        if (!audioStateRef.current.wasManuallyPaused) {
          if (DEBUG_PROXIMITY_AUDIO) {
            console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Source audio (proximity - entering)');
          }
          
          // Pause destination audio if playing
          if (audioStateRef.current.destinationAudio && !audioStateRef.current.destinationAudio.paused) {
            audioStateRef.current.destinationAudio.pause();
          }

          audioStateRef.current.sourceAudio.play()
            .then(() => {
              if (DEBUG_PROXIMITY_AUDIO) {
                console.log('[ProximityAudio] ✅ PLAYBACK STARTED: Source audio (proximity)');
              }
            })
            .catch((error) => {
              console.error('[ProximityAudio] ❌ PLAYBACK FAILED: Source audio (proximity):', error);
            });
          
          audioStateRef.current.currentlyPlaying = 'source';
          setKeyboardControlActive(null);
        } else {
          if (DEBUG_PROXIMITY_AUDIO) {
            console.log('[ProximityAudio] ⏸️ SKIPPING auto-play: Source audio was manually paused');
          }
        }
      } else if (!isInsideSource && audioStateRef.current.sourceAudio && audioStateRef.current.currentlyPlaying === 'source') {
        // Exiting source cuboid
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🚪 EXITED source cuboid');
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Source audio (proximity - exiting)');
        }
        audioStateRef.current.sourceAudio.pause();
        
        audioStateRef.current.currentlyPlaying = null;
        // Don't reset wasManuallyPaused - preserve user's intent
        setKeyboardControlActive(null);
      }
    }

    // Handle destination location audio
    if (isInsideDestination !== audioStateRef.current.isDestinationInside) {
      audioStateRef.current.isDestinationInside = isInsideDestination;

      if (isInsideDestination && audioStateRef.current.destinationAudio) {
        // Entering destination cuboid
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🚪 ENTERED destination cuboid');
        }

        // Only auto-play if not manually paused
        if (!audioStateRef.current.wasManuallyPaused) {
          if (DEBUG_PROXIMITY_AUDIO) {
            console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Destination audio (proximity - entering)');
          }
          
          // Pause source audio if playing
          if (audioStateRef.current.sourceAudio && !audioStateRef.current.sourceAudio.paused) {
            audioStateRef.current.sourceAudio.pause();
          }

          audioStateRef.current.destinationAudio.play()
            .then(() => {
              if (DEBUG_PROXIMITY_AUDIO) {
                console.log('[ProximityAudio] ✅ PLAYBACK STARTED: Destination audio (proximity)');
              }
            })
            .catch((error) => {
              console.error('[ProximityAudio] ❌ PLAYBACK FAILED: Destination audio (proximity):', error);
            });
          
          audioStateRef.current.currentlyPlaying = 'destination';
          setKeyboardControlActive(null);
        } else {
          if (DEBUG_PROXIMITY_AUDIO) {
            console.log('[ProximityAudio] ⏸️ SKIPPING auto-play: Destination audio was manually paused');
          }
        }
      } else if (!isInsideDestination && audioStateRef.current.destinationAudio && audioStateRef.current.currentlyPlaying === 'destination') {
        // Exiting destination cuboid
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🚪 EXITED destination cuboid');
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Destination audio (proximity - exiting)');
        }
        audioStateRef.current.destinationAudio.pause();
        
        audioStateRef.current.currentlyPlaying = null;
        // Don't reset wasManuallyPaused - preserve user's intent
        setKeyboardControlActive(null);
      }
    }

  }, [position, sourceLocation, destinationLocation, isStreetViewLoaded, isAudioReady]);

  if (DEBUG_PROXIMITY_AUDIO) {
    console.log('[ProximityAudio] 🔄 Hook render complete, returning state:', {
      isAudioReady,
      isInsideSource: audioStateRef.current.isSourceInside,
      isInsideDestination: audioStateRef.current.isDestinationInside,
      currentlyPlaying: audioStateRef.current.currentlyPlaying,
      keyboardControlActive,
    });
  }

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
