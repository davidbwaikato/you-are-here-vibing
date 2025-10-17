/**
 * URL Parameter Utilities
 * Handles parsing and validation of URL parameters for location data
 */

export interface LocationParams {
  src?: string;
  dst?: string;
}

/**
 * Parse URL parameters for source and destination locations
 */
export const parseLocationParams = (): LocationParams => {
  const params = new URLSearchParams(window.location.search);
  
  return {
    src: params.get('src') || undefined,
    dst: params.get('dst') || undefined,
  };
};

/**
 * Update URL with new location parameters without page reload
 */
export const updateLocationParams = (params: Partial<LocationParams>) => {
  const searchParams = new URLSearchParams(window.location.search);
  
  if (params.src !== undefined) {
    if (params.src) {
      searchParams.set('src', params.src);
    } else {
      searchParams.delete('src');
    }
  }
  
  if (params.dst !== undefined) {
    if (params.dst) {
      searchParams.set('dst', params.dst);
    } else {
      searchParams.delete('dst');
    }
  }
  
  const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
};
