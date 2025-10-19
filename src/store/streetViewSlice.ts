import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LatLng {
  lat: number;
  lng: number;
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
  destinationLocation: {
    lat: number;
    lng: number;
  } | null;
  sourceAddress: string | null;
  destinationAddress: string | null;
  routePolyline: LatLng[];
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
  destinationLocation: null,
  sourceAddress: null,
  destinationAddress: null,
  routePolyline: [],
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
    clearRoute: (state) => {
      console.log('[Redux Reducer] clearRoute called');
      state.routePolyline = [];
      state.destinationLocation = null;
      state.destinationAddress = null;
      console.log('[Redux Reducer] Route cleared:', {
        routePolyline: state.routePolyline.length,
        destinationLocation: state.destinationLocation,
        destinationAddress: state.destinationAddress,
      });
    },
  },
});

export const { 
  setPosition, 
  setPov, 
  setZoom, 
  setLoaded, 
  setVideoOverlayEnabled,
  setDestinationLocation,
  setSourceAddress,
  setDestinationAddress,
  setRoutePolyline,
  clearRoute,
} = streetViewSlice.actions;
export default streetViewSlice.reducer;
