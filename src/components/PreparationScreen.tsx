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
  | 'calculating-route'
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
  const hasExecutedRef = useRef(false);

  const sourceDetails = useSelector((state: RootState) => state.streetView.sourceDetails);
  const destinationDetails = useSelector((state: RootState) => state.streetView.destinationDetails);
  const ttsVoice = useSelector((state: RootState) => state.streetView.ttsVoice);
  const sourceShortName = useSelector((state: RootState) => state.streetView.currentShortName);
  const destinationShortName = useSelector((state: RootState) => state.streetView.destinationShortName);
  
  const [isPreparationComplete, setIsPreparationComplete] = useState(false);
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const displaySourceName = sourceShortName || sourceAddress;
  const displayDestinationName = destinationShortName || destinationAddress;

  useEffect(() => {
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    const executePreparation = async () => {
      try {
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

        setCurrentStep('generating-descriptions');
        setProgress(5);

        const sourceResult = await generateEnhancedDescription(
          sourceAddress,
          `A location at ${sourceAddress}`,
          ['tourist_attraction', 'point_of_interest']
        );
				
        if ('enhancedDescription' in sourceResult) {
          dispatch(updateSourceEnhancedDescription(sourceResult.enhancedDescription));
        }
				setProgress(15);

        const destResult = await generateEnhancedDescription(
          destinationAddress,
          `A location at ${destinationAddress}`,
          ['tourist_attraction', 'point_of_interest']
        );

        if ('enhancedDescription' in destResult) {
          dispatch(updateDestinationEnhancedDescription(destResult.enhancedDescription));
        }

        setCurrentStep('synthesizing-audio');
        setProgress(20);

        if ('enhancedDescription' in sourceResult) {
          const sourceAudioResult = await synthesizeTextToSpeech(
            sourceResult.enhancedDescription, 
            ttsVoice,
            sourceAddress
          );
          if ('audioUrl' in sourceAudioResult) {
            dispatch(updateSourceAudio({
              audioUrl: sourceAudioResult.audioUrl,
              audioFilename: sourceAudioResult.filename,
            }));
          }
        }
				setProgress(50);
				
        if ('enhancedDescription' in destResult) {
          const destAudioResult = await synthesizeTextToSpeech(
            destResult.enhancedDescription, 
            ttsVoice,
            destinationAddress
          );
          if ('audioUrl' in destAudioResult) {
            dispatch(updateDestinationAudio({
              audioUrl: destAudioResult.audioUrl,
              audioFilename: destAudioResult.filename,
            }));
          }
        }

        setCurrentStep('calculating-route');
        setProgress(80);

        if (sourceLocation && destinationLocation) {
          const routeResult = await fetchWalkingRoute(
            sourceLocation,
            destinationLocation,
            googleMapsApiKey
          );

          if (!('error' in routeResult)) {
            dispatch(setRoutePolyline(routeResult.decodedPolyline));
          }
        }
				
        setCurrentStep('complete');
        setProgress(100);
        setIsPreparationComplete(true);
      } catch (error) {
        console.error('Error during preparation:', error);
        setIsPreparationComplete(true);
      }
    };

    executePreparation();
  }, [sourceLocation, destinationLocation, sourceAddress, destinationAddress, dispatch, googleMapsApiKey, ttsVoice]);

  useEffect(() => {
    if (!isPreparationComplete) return;

    const hasAudioData = sourceDetails?.audioUrl || destinationDetails?.audioUrl;
    
    if (hasAudioData) {
      setTimeout(() => {
        onPreparationComplete();
      }, 500);
    } else {
      const checkInterval = setInterval(() => {
        const currentHasAudio = sourceDetails?.audioUrl || destinationDetails?.audioUrl;
        if (currentHasAudio) {
          clearInterval(checkInterval);
          setTimeout(() => {
            onPreparationComplete();
          }, 500);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
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
      case 'calculating-route':
        return 'Calculating your route...';
      case 'complete':
        return 'Ready to explore!';
    }
  };

  const getStepIcon = (step: PreparationStep) => {
    switch (step) {
      case 'generating-descriptions':
      case 'synthesizing-audio':
        return <Loader2 className="w-8 h-8 text-white animate-spin" />;
      case 'calculating-route':
        return <Route className="w-8 h-8 text-white animate-pulse" />;
      case 'complete':
        return <MapPin className="w-8 h-8 text-white" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 px-4 max-w-md w-full">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl rounded-full" />
          <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-2xl shadow-2xl">
            {getStepIcon(currentStep)}
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-5xl font-light tracking-tight text-slate-900">
            Preparing <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Journey</span>
          </h1>
          <p className="text-lg text-slate-500 font-light tracking-wide">
            {getStepMessage(currentStep)}
          </p>
        </div>

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

        <div className="w-full space-y-2 bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium">From</p>
              <p className="text-sm text-slate-700 truncate" title={displaySourceName}>
                {displaySourceName}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium">To</p>
              <p className="text-sm text-slate-700 truncate" title={displayDestinationName}>
                {displayDestinationName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
