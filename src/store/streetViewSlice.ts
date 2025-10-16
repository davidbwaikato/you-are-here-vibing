import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
  },
});

export const { setPosition, setPov, setZoom, setLoaded, setVideoOverlayEnabled } = streetViewSlice.actions;
export default streetViewSlice.reducer;
