import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LatLng {
  lat: number;
  lng: number;
}

interface LocationDetails {
  description: string;
  name: string;
  types: string[];
  enhancedDescription?: string;
  audioUrl?: string;
  audioFilename?: string;
}

interface StreetViewState {
  position: {
    lat: number;
    lng: number;
  };
  pov: {
    heading: number;
    pitch: number;
  };
  zoom: number;
  isLoaded: boolean;
  isVideoOverlayEnabled: boolean;
  sourceLocation: {
    lat: number;
    lng: number;
  } | null;
  destinationLocation: {
    lat: number;
    lng: number;
  } | null;
  sourceAddress: string | null;
  destinationAddress: string | null;
  sourceDetails: LocationDetails | null;
  destinationDetails: LocationDetails | null;
  routePolyline: LatLng[];
  selectedMarkerIndex: number;
  isFistTrackingActive: boolean;
}

const initialState: StreetViewState = {
  position: {
    lat: 41.9007576,
    lng: 12.4832866,
  },
  pov: {
    heading: 355.84,
    pitch: -1.84,
  },
  zoom: 1,
  isLoaded: false,
  isVideoOverlayEnabled: true,
  sourceLocation: null,
  destinationLocation: null,
  sourceAddress: null,
  destinationAddress: null,
  sourceDetails: null,
  destinationDetails: null,
  routePolyline: [],
  selectedMarkerIndex: 0,
  isFistTrackingActive: false,
};

const streetViewSlice = createSlice({
  name: 'streetView',
  initialState,
  reducers: {
    setPosition: (state, action: PayloadAction<{ lat: number; lng: number }>) => {
      console.log('[Redux Reducer] setPosition called with:', action.payload);
      state.position = action.payload;
      console.log('[Redux Reducer] New position state:', state.position);
    },
    setPov: (state, action: PayloadAction<{ heading: number; pitch: number }>) => {
      console.log('[Redux Reducer] setPov called with:', action.payload);
      state.pov = action.payload;
      console.log('[Redux Reducer] New pov state:', state.pov);
    },
    setZoom: (state, action: PayloadAction<number>) => {
      console.log('[Redux Reducer] setZoom called with:', action.payload);
      state.zoom = action.payload;
      console.log('[Redux Reducer] New zoom state:', state.zoom);
    },
    setLoaded: (state, action: PayloadAction<boolean>) => {
      console.log('[Redux Reducer] setLoaded called with:', action.payload);
      state.isLoaded = action.payload;
      console.log('[Redux Reducer] New isLoaded state:', state.isLoaded);
    },
    setVideoOverlayEnabled: (state, action: PayloadAction<boolean>) => {
      console.log('[Redux Reducer] setVideoOverlayEnabled called with:', action.payload);
      state.isVideoOverlayEnabled = action.payload;
      console.log('[Redux Reducer] New isVideoOverlayEnabled state:', state.isVideoOverlayEnabled);
    },
    setSourceLocation: (state, action: PayloadAction<{ lat: number; lng: number } | null>) => {
      console.log('[Redux Reducer] setSourceLocation called with:', action.payload);
      state.sourceLocation = action.payload;
      console.log('[Redux Reducer] New sourceLocation state:', state.sourceLocation);
    },
    setDestinationLocation: (state, action: PayloadAction<{ lat: number; lng: number } | null>) => {
      console.log('[Redux Reducer] setDestinationLocation called with:', action.payload);
      state.destinationLocation = action.payload;
      console.log('[Redux Reducer] New destinationLocation state:', state.destinationLocation);
    },
    setSourceAddress: (state, action: PayloadAction<string | null>) => {
      console.log('[Redux Reducer] setSourceAddress called with:', action.payload);
      state.sourceAddress = action.payload;
      console.log('[Redux Reducer] New sourceAddress state:', state.sourceAddress);
    },
    setDestinationAddress: (state, action: PayloadAction<string | null>) => {
      console.log('[Redux Reducer] setDestinationAddress called with:', action.payload);
      state.destinationAddress = action.payload;
      console.log('[Redux Reducer] New destinationAddress state:', state.destinationAddress);
    },
    setSourceDetails: (state, action: PayloadAction<LocationDetails | null>) => {
      console.log('[Redux Reducer] setSourceDetails called with:', action.payload);
      state.sourceDetails = action.payload;
      console.log('[Redux Reducer] New sourceDetails state:', state.sourceDetails);
    },
    setDestinationDetails: (state, action: PayloadAction<LocationDetails | null>) => {
      console.log('[Redux Reducer] setDestinationDetails called with:', action.payload);
      state.destinationDetails = action.payload;
      console.log('[Redux Reducer] New destinationDetails state:', state.destinationDetails);
    },
    updateSourceEnhancedDescription: (state, action: PayloadAction<string>) => {
      console.log('[Redux Reducer] updateSourceEnhancedDescription called with length:', action.payload.length);
      if (state.sourceDetails) {
        state.sourceDetails.enhancedDescription = action.payload;
        console.log('[Redux Reducer] ✅ Source enhanced description updated');
      } else {
        console.error('[Redux Reducer] ❌ Cannot update source description - sourceDetails is null!');
      }
    },
    updateDestinationEnhancedDescription: (state, action: PayloadAction<string>) => {
      console.log('[Redux Reducer] updateDestinationEnhancedDescription called with length:', action.payload.length);
      if (state.destinationDetails) {
        state.destinationDetails.enhancedDescription = action.payload;
        console.log('[Redux Reducer] ✅ Destination enhanced description updated');
      } else {
        console.error('[Redux Reducer] ❌ Cannot update destination description - destinationDetails is null!');
      }
    },
    updateSourceAudio: (state, action: PayloadAction<{ audioUrl: string; audioFilename: string }>) => {
      console.log('[Redux Reducer] updateSourceAudio called with:', {
        audioUrl: action.payload.audioUrl.substring(0, 50) + '...',
        audioFilename: action.payload.audioFilename,
      });
      if (state.sourceDetails) {
        state.sourceDetails.audioUrl = action.payload.audioUrl;
        state.sourceDetails.audioFilename = action.payload.audioFilename;
        console.log('[Redux Reducer] ✅ Source audio updated successfully');
        console.log('[Redux Reducer] 📊 Current sourceDetails:', {
          hasAudioUrl: !!state.sourceDetails.audioUrl,
          audioFilename: state.sourceDetails.audioFilename,
        });
      } else {
        console.error('[Redux Reducer] ❌ Cannot update source audio - sourceDetails is null!');
      }
    },
    updateDestinationAudio: (state, action: PayloadAction<{ audioUrl: string; audioFilename: string }>) => {
      console.log('[Redux Reducer] updateDestinationAudio called with:', {
        audioUrl: action.payload.audioUrl.substring(0, 50) + '...',
        audioFilename: action.payload.audioFilename,
      });
      if (state.destinationDetails) {
        state.destinationDetails.audioUrl = action.payload.audioUrl;
        state.destinationDetails.audioFilename = action.payload.audioFilename;
        console.log('[Redux Reducer] ✅ Destination audio updated successfully');
        console.log('[Redux Reducer] 📊 Current destinationDetails:', {
          hasAudioUrl: !!state.destinationDetails.audioUrl,
          audioFilename: state.destinationDetails.audioFilename,
        });
      } else {
        console.error('[Redux Reducer] ❌ Cannot update destination audio - destinationDetails is null!');
      }
    },
    setRoutePolyline: (state, action: PayloadAction<LatLng[]>) => {
      console.log('[Redux Reducer] setRoutePolyline called with:', {
        pointCount: action.payload.length,
        firstPoint: action.payload[0],
        lastPoint: action.payload[action.payload.length - 1],
      });
      state.routePolyline = action.payload;
      console.log('[Redux Reducer] New routePolyline state:', {
        totalPoints: state.routePolyline.length,
      });
    },
    setSelectedMarkerIndex: (state, action: PayloadAction<number>) => {
      console.log('[Redux Reducer] setSelectedMarkerIndex called with:', action.payload);
      state.selectedMarkerIndex = action.payload;
      console.log('[Redux Reducer] New selectedMarkerIndex state:', state.selectedMarkerIndex);
    },
    setFistTrackingActive: (state, action: PayloadAction<boolean>) => {
      console.log('[Redux Reducer] setFistTrackingActive called with:', action.payload);
      state.isFistTrackingActive = action.payload;
      console.log('[Redux Reducer] New isFistTrackingActive state:', state.isFistTrackingActive);
    },
    clearRoute: (state) => {
      console.log('[Redux Reducer] clearRoute called');
      state.routePolyline = [];
      state.sourceLocation = null;
      state.destinationLocation = null;
      state.sourceAddress = null;
      state.destinationAddress = null;
      state.sourceDetails = null;
      state.destinationDetails = null;
      state.selectedMarkerIndex = 0;
      state.isFistTrackingActive = false;
      console.log('[Redux Reducer] Route cleared');
    },
  },
});

export const { 
  setPosition, 
  setPov, 
  setZoom, 
  setLoaded, 
  setVideoOverlayEnabled,
  setSourceLocation,
  setDestinationLocation,
  setSourceAddress,
  setDestinationAddress,
  setSourceDetails,
  setDestinationDetails,
  updateSourceEnhancedDescription,
  updateDestinationEnhancedDescription,
  updateSourceAudio,
  updateDestinationAudio,
  setRoutePolyline,
  setSelectedMarkerIndex,
  setFistTrackingActive,
  clearRoute,
} = streetViewSlice.actions;
export default streetViewSlice.reducer;
