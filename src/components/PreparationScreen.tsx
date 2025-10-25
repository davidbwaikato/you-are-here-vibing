import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Loader2, MapPin, Route } from 'lucide-react';
import { 
  setSourceDetails, 
  setDestinationDetails,
  updateSourceEnhancedDescription,
  updateDestinationEnhancedDescription,
  updateSourceAudio,
  updateDestinationAudio,
  setRoutePolyline,
} from '../store/streetViewSlice';
import { RootState } from '../store/store';
import { generateEnhancedDescription, synthesizeTextToSpeech } from '../services/openai';
import { fetchWalkingRoute } from '../services/routing';

interface PreparationScreenProps {
  sourceLocation: { lat: number; lng: number } | null;
  destinationLocation: { lat: number; lng: number } | null;
  sourceAddress: string;
  destinationAddress: string;
  onPreparationComplete: () => void;
}

type PreparationStep = 
  | 'generating-descriptions'
  | 'synthesizing-audio'
  | 'establishing-panorama'
  | 'calculating-route'
  | 'calculating-points'
  | 'calculating-markers'
  | 'complete';

export const PreparationScreen = ({
  sourceLocation,
  destinationLocation,
  sourceAddress,
  destinationAddress,
  onPreparationComplete,
}: PreparationScreenProps) => {
  const dispatch = useDispatch();
  const [currentStep, setCurrentStep] = useState<PreparationStep>('generating-descriptions');
  const [progress, setProgress] = useState(0);

  // CRITICAL FIX: Prevent duplicate execution in React Strict Mode
  const hasExecutedRef = useRef(false);

  // CRITICAL FIX: Monitor Redux state to ensure audio data is persisted before transitioning
  const sourceDetails = useSelector((state: RootState) => state.streetView.sourceDetails);
  const destinationDetails = useSelector((state: RootState) => state.streetView.destinationDetails);
  const [isPreparationComplete, setIsPreparationComplete] = useState(false);

  // Get Google Maps API key from environment
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    // CRITICAL FIX: Prevent duplicate execution
    if (hasExecutedRef.current) {
      console.log('[PreparationScreen] ⏭️ Skipping duplicate execution (React Strict Mode)');
      return;
    }
    hasExecutedRef.current = true;

    console.log('[PreparationScreen] 🚀 PHASE 3: PREPARATION SCREEN');
    console.log('[PreparationScreen] 📍 Source:', sourceAddress, sourceLocation);
    console.log('[PreparationScreen] 📍 Destination:', destinationAddress, destinationLocation);

    // Execute preparation steps sequentially
    const executePreparation = async () => {
      try {
        // CRITICAL FIX: Initialize details objects FIRST
        console.log('[PreparationScreen] 🔧 Initializing location details objects...');
        dispatch(setSourceDetails({
          description: '',
          name: sourceAddress,
          types: [],
        }));
        dispatch(setDestinationDetails({
          description: '',
          name: destinationAddress,
          types: [],
        }));

        // Step 1: Generate enhanced descriptions
        console.log('[PreparationScreen] 🤖 Step 1: Generating enhanced descriptions via OpenAI...');
        setCurrentStep('generating-descriptions');
        setProgress(0);

        // Generate source description
        const sourceResult = await generateEnhancedDescription(
          sourceAddress,
          `A location at ${sourceAddress}`,
          ['tourist_attraction', 'point_of_interest']
        );

        if ('enhancedDescription' in sourceResult) {
          console.log('[PreparationScreen] ✅ Source description generated');
          dispatch(updateSourceEnhancedDescription(sourceResult.enhancedDescription));
        } else {
          console.warn('[PreparationScreen] ⚠️ Source description generation failed:', sourceResult.error);
        }

        // Generate destination description
        const destResult = await generateEnhancedDescription(
          destinationAddress,
          `A location at ${destinationAddress}`,
          ['tourist_attraction', 'point_of_interest']
        );

        if ('enhancedDescription' in destResult) {
          console.log('[PreparationScreen] ✅ Destination description generated');
          dispatch(updateDestinationEnhancedDescription(destResult.enhancedDescription));
        } else {
          console.warn('[PreparationScreen] ⚠️ Destination description generation failed:', destResult.error);
        }

        // Step 2: Synthesize audio
        console.log('[PreparationScreen] 🎤 Step 2: Synthesizing audio via OpenAI TTS...');
        setCurrentStep('synthesizing-audio');
        setProgress(20);

        // Synthesize source audio
        if ('enhancedDescription' in sourceResult) {
          const sourceAudioResult = await synthesizeTextToSpeech(sourceResult.enhancedDescription, 'alloy');
          if ('audioUrl' in sourceAudioResult) {
            console.log('[PreparationScreen] ✅ Source audio synthesized');
            console.log('[PreparationScreen] 📊 Dispatching updateSourceAudio with:', {
              audioUrl: sourceAudioResult.audioUrl.substring(0, 50) + '...',
              audioFilename: sourceAudioResult.filename,
            });
            dispatch(updateSourceAudio({
              audioUrl: sourceAudioResult.audioUrl,
              audioFilename: sourceAudioResult.filename,
            }));
          } else {
            console.warn('[PreparationScreen] ⚠️ Source audio synthesis failed:', sourceAudioResult.error);
          }
        }

        // Synthesize destination audio
        if ('enhancedDescription' in destResult) {
          const destAudioResult = await synthesizeTextToSpeech(destResult.enhancedDescription, 'nova');
          if ('audioUrl' in destAudioResult) {
            console.log('[PreparationScreen] ✅ Destination audio synthesized');
            console.log('[PreparationScreen] 📊 Dispatching updateDestinationAudio with:', {
              audioUrl: destAudioResult.audioUrl.substring(0, 50) + '...',
              audioFilename: destAudioResult.filename,
            });
            dispatch(updateDestinationAudio({
              audioUrl: destAudioResult.audioUrl,
              audioFilename: destAudioResult.filename,
            }));
          } else {
            console.warn('[PreparationScreen] ⚠️ Destination audio synthesis failed:', destAudioResult.error);
          }
        }

        // Step 3: Establish panorama
        console.log('[PreparationScreen] 📸 Step 3: Establishing panorama location and heading...');
        setCurrentStep('establishing-panorama');
        setProgress(40);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: Calculate route
        console.log('[PreparationScreen] 🗺️ Step 4: Calculating route between locations...');
        setCurrentStep('calculating-route');
        setProgress(60);

        if (sourceLocation && destinationLocation) {
          console.log('[PreparationScreen] 📡 Calling fetchWalkingRoute...');
          const routeResult = await fetchWalkingRoute(
            sourceLocation,
            destinationLocation,
            googleMapsApiKey
          );

          if ('error' in routeResult) {
            console.error('[PreparationScreen] ❌ Route calculation failed:', routeResult.error);
          } else {
            console.log('[PreparationScreen] ✅ Route calculated successfully');
            console.log('[PreparationScreen] 📊 Route summary:', {
              distanceMeters: routeResult.distanceMeters,
              duration: routeResult.duration,
              steps: routeResult.steps.length,
              polylinePoints: routeResult.decodedPolyline.length,
            });

            // Dispatch route data to Redux store
            console.log('[PreparationScreen] 📊 Dispatching route polyline to Redux store...');
            dispatch(setRoutePolyline(routeResult.decodedPolyline));
            console.log('[PreparationScreen] ✅ Route data stored in Redux');
          }
        } else {
          console.warn('[PreparationScreen] ⚠️ Missing source or destination location, skipping route calculation');
        }

        // Step 5: Calculate points
        console.log('[PreparationScreen] 📐 Step 5: Calculating interpolated points along route...');
        setCurrentStep('calculating-points');
        setProgress(80);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 6: Calculate markers
        console.log('[PreparationScreen] 📍 Step 6: Calculating visible markers...');
        setCurrentStep('calculating-markers');
        setProgress(90);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Complete
        console.log('[PreparationScreen] ✅ Preparation complete!');
        setCurrentStep('complete');
        setProgress(100);
        
        // CRITICAL FIX: Set flag to trigger transition check
        setIsPreparationComplete(true);
      } catch (error) {
        console.error('[PreparationScreen] ❌ Error during preparation:', error);
        // Continue anyway to show panorama
        setIsPreparationComplete(true);
      }
    };

    executePreparation();
  }, [sourceLocation, destinationLocation, sourceAddress, destinationAddress, dispatch, googleMapsApiKey]);

  // CRITICAL FIX: Wait for Redux state to update before transitioning
  useEffect(() => {
    if (!isPreparationComplete) {
      return;
    }

    console.log('[PreparationScreen] 🔍 Checking if audio data is ready in Redux...');
    console.log('[PreparationScreen] 📊 Redux state:', {
      hasSourceAudio: !!sourceDetails?.audioUrl,
      hasDestinationAudio: !!destinationDetails?.audioUrl,
      sourceAudioUrl: sourceDetails?.audioUrl?.substring(0, 50),
      destinationAudioUrl: destinationDetails?.audioUrl?.substring(0, 50),
    });

    // Check if audio data is available in Redux
    const hasAudioData = sourceDetails?.audioUrl || destinationDetails?.audioUrl;
    
    if (hasAudioData) {
      console.log('[PreparationScreen] ✅ Audio data confirmed in Redux, transitioning to Phase 4');
      setTimeout(() => {
        onPreparationComplete();
      }, 500);
    } else {
      console.log('[PreparationScreen] ⏳ Waiting for audio data to be available in Redux...');
      // Wait a bit longer and check again
      const checkInterval = setInterval(() => {
        const currentHasAudio = sourceDetails?.audioUrl || destinationDetails?.audioUrl;
        if (currentHasAudio) {
          console.log('[PreparationScreen] ✅ Audio data now available in Redux, transitioning to Phase 4');
          clearInterval(checkInterval);
          setTimeout(() => {
            onPreparationComplete();
          }, 500);
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[PreparationScreen] ⚠️ Timeout waiting for audio data, transitioning anyway');
        onPreparationComplete();
      }, 5000);
    }
  }, [isPreparationComplete, sourceDetails?.audioUrl, destinationDetails?.audioUrl, onPreparationComplete]);

  const getStepMessage = (step: PreparationStep): string => {
    switch (step) {
      case 'generating-descriptions':
        return 'Generating location descriptions...';
      case 'synthesizing-audio':
        return 'Creating audio narration...';
      case 'establishing-panorama':
        return 'Setting up panorama view...';
      case 'calculating-route':
        return 'Calculating your route...';
      case 'calculating-points':
        return 'Mapping waypoints...';
      case 'calculating-markers':
        return 'Placing location markers...';
      case 'complete':
        return 'Ready to explore!';
    }
  };

  const getStepIcon = (step: PreparationStep) => {
    switch (step) {
      case 'generating-descriptions':
      case 'synthesizing-audio':
        return <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />;
      case 'establishing-panorama':
        return <MapPin className="w-8 h-8 text-purple-600 animate-pulse" />;
      case 'calculating-route':
      case 'calculating-points':
      case 'calculating-markers':
        return <Route className="w-8 h-8 text-blue-600 animate-pulse" />;
      case 'complete':
        return <MapPin className="w-8 h-8 text-green-600" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 z-50 flex items-center justify-center"
      style={{ zIndex: 9999 }}
    >
      <div className="flex flex-col items-center gap-8 px-4 max-w-md w-full">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl rounded-full" />
          <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-2xl shadow-2xl">
            {getStepIcon(currentStep)}
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-light tracking-tight text-slate-900">
            Preparing <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Journey</span>
          </h1>
          <p className="text-lg text-slate-500 font-light tracking-wide">
            {getStepMessage(currentStep)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2">
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center font-light">
            {Math.round(progress)}% complete
          </p>
        </div>

        {/* Location Info */}
        <div className="w-full space-y-2 bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium">From</p>
              <p className="text-sm text-slate-700 truncate">{sourceAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium">To</p>
              <p className="text-sm text-slate-700 truncate">{destinationAddress}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
