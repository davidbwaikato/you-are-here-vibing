import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { LatLng } from '@/utils/geoUtils';

/**
 * Hook for accessing route polyline from Redux store
 * Returns raw LatLng array - no processing or conversion
 */
export const useRoutePolyline = () => {
  const routePolyline = useSelector((state: RootState) => state.streetView.routePolyline);

  return {
    routePolyline,
    hasRoute: routePolyline.length > 0,
  };
};
