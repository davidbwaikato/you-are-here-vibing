import { configureStore } from '@reduxjs/toolkit';
import streetViewReducer from './streetViewSlice';

export const store = configureStore({
  reducer: {
    streetView: streetViewReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
