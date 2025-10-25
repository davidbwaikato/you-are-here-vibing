import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { isUserInsideLocationCuboid } from '@/utils/proximityDetection';

// Debug flag to control console logging
const DEBUG_PROXIMITY_AUDIO = false;

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

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎹 KEYBOARD CONTROL: Toggle source audio requested');
    }

    if (audio.paused) {
      // Play source audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Source audio');
      }
      
      // Pause destination audio if playing
      if (audioStateRef.current.destinationAudio && !audioStateRef.current.destinationAudio.paused) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Destination audio (to play source)');
        }
        audioStateRef.current.destinationAudio.pause();
        audioStateRef.current.manualControl.destination = true;
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
      audioStateRef.current.manualControl.source = false;
      setKeyboardControlActive('source');
    } else {
      // Pause source audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Source audio');
      }
      audio.pause();
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ✅ PLAYBACK PAUSED: Source audio paused successfully');
      }
      
      audioStateRef.current.currentlyPlaying = null;
      audioStateRef.current.manualControl.source = true;
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

    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎹 KEYBOARD CONTROL: Toggle destination audio requested');
    }

    if (audio.paused) {
      // Play destination audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Destination audio');
      }
      
      // Pause source audio if playing
      if (audioStateRef.current.sourceAudio && !audioStateRef.current.sourceAudio.paused) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Source audio (to play destination)');
        }
        audioStateRef.current.sourceAudio.pause();
        audioStateRef.current.manualControl.source = true;
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
      audioStateRef.current.manualControl.destination = false;
      setKeyboardControlActive('destination');
    } else {
      // Pause destination audio
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Destination audio');
      }
      audio.pause();
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ✅ PLAYBACK PAUSED: Destination audio paused successfully');
      }
      
      audioStateRef.current.currentlyPlaying = null;
      audioStateRef.current.manualControl.destination = true;
      setKeyboardControlActive(null);
    }
  }, []);

  // Initialize audio elements when audio URLs are available
  useEffect(() => {
    if (DEBUG_PROXIMITY_AUDIO) {
      console.log('[ProximityAudio] 🎵 Audio initialization effect running...', {
        hasSourceAudio: !!sourceDetails?.audioUrl,
        hasDestinationAudio: !!destinationDetails?.audioUrl,
        isStreetViewLoaded,
      });
    }

    if (!isStreetViewLoaded) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] ⏸️ Street View not loaded yet, waiting...');
      }
      return;
    }

    let sourceAudioElement: HTMLAudioElement | null = null;
    let destinationAudioElement: HTMLAudioElement | null = null;

    // Create source audio element
    if (sourceDetails?.audioUrl && !audioStateRef.current.sourceAudio) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] 🎵 Creating source audio element:', {
          filename: sourceDetails.audioFilename,
          url: sourceDetails.audioUrl.substring(0, 50) + '...',
        });
      }

      sourceAudioElement = new Audio(sourceDetails.audioUrl);
      sourceAudioElement.preload = 'auto';
      
      sourceAudioElement.addEventListener('canplaythrough', () => {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ✅ Source audio ready to play');
        }
        setIsAudioReady(true);
      });

      sourceAudioElement.addEventListener('error', (e) => {
        console.error('[ProximityAudio] ❌ Source audio error:', e);
      });

      audioStateRef.current.sourceAudio = sourceAudioElement;
    }

    // Create destination audio element
    if (destinationDetails?.audioUrl && !audioStateRef.current.destinationAudio) {
      if (DEBUG_PROXIMITY_AUDIO) {
        console.log('[ProximityAudio] 🎵 Creating destination audio element:', {
          filename: destinationDetails.audioFilename,
          url: destinationDetails.audioUrl.substring(0, 50) + '...',
        });
      }

      destinationAudioElement = new Audio(destinationDetails.audioUrl);
      destinationAudioElement.preload = 'auto';
      
      destinationAudioElement.addEventListener('canplaythrough', () => {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ✅ Destination audio ready to play');
        }
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
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🧹 Cleaning up source audio element');
        }
        sourceAudioElement.pause();
        sourceAudioElement.src = '';
      }
      if (destinationAudioElement) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] 🧹 Cleaning up destination audio element');
        }
        destinationAudioElement.pause();
        destinationAudioElement.src = '';
      }
    };
  }, [sourceDetails?.audioUrl, destinationDetails?.audioUrl, isStreetViewLoaded]);

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

  // Handle proximity detection and audio playback
  useEffect(() => {
    if (!isStreetViewLoaded || !isAudioReady) {
      return;
    }

    // Check if user is inside source location cuboid
    const isInsideSource = sourceLocation 
      ? isUserInsideLocationCuboid(position, sourceLocation)
      : false;

    // Check if user is inside destination location cuboid
    const isInsideDestination = destinationLocation
      ? isUserInsideLocationCuboid(position, destinationLocation)
      : false;

    // Handle source location audio (only if not manually controlled)
    if (isInsideSource !== audioStateRef.current.isSourceInside) {
      audioStateRef.current.isSourceInside = isInsideSource;

      if (isInsideSource && audioStateRef.current.sourceAudio && !audioStateRef.current.manualControl.source) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Source audio (proximity-based)');
        }
        
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
      } else if (!isInsideSource && audioStateRef.current.sourceAudio && audioStateRef.current.currentlyPlaying === 'source') {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Source audio (exited cuboid)');
        }
        audioStateRef.current.sourceAudio.pause();
        
        audioStateRef.current.currentlyPlaying = null;
        audioStateRef.current.manualControl.source = false;
        setKeyboardControlActive(null);
      }
    }

    // Handle destination location audio (only if not manually controlled)
    if (isInsideDestination !== audioStateRef.current.isDestinationInside) {
      audioStateRef.current.isDestinationInside = isInsideDestination;

      if (isInsideDestination && audioStateRef.current.destinationAudio && !audioStateRef.current.manualControl.destination) {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ▶️ TRIGGERING PLAY: Destination audio (proximity-based)');
        }
        
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
      } else if (!isInsideDestination && audioStateRef.current.destinationAudio && audioStateRef.current.currentlyPlaying === 'destination') {
        if (DEBUG_PROXIMITY_AUDIO) {
          console.log('[ProximityAudio] ⏸️ TRIGGERING PAUSE: Destination audio (exited cuboid)');
        }
        audioStateRef.current.destinationAudio.pause();
        
        audioStateRef.current.currentlyPlaying = null;
        audioStateRef.current.manualControl.destination = false;
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
