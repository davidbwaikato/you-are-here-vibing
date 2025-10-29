// src/utils/panoramaHelper.ts
// Utilities for finding a suitable Street View panorama near a target

export type GoodPano = {
  data: google.maps.StreetViewPanoramaData;
  status: google.maps.StreetViewStatus;
};

/** Promisified wrapper around StreetViewService.getPanorama */
export function getPanoramaByLocationAsync(
  svs: google.maps.StreetViewService,
  latLng: google.maps.LatLng | google.maps.LatLngLiteral,
  radiusMeters: number
): Promise<GoodPano> {
  return new Promise((resolve) => {
    svs.getPanorama({ location: latLng, radius: radiusMeters }, (data, status) =>
      resolve({ data: data!, status })
    );
  });
}

/** Bearings for a ring (8-way default) */
export function ringBearings(segments = 8): number[] {
  const out: number[] = [];
  const step = 360 / segments;
  for (let b = 0; b < 360; b += step) out.push(b);
  return out;
}

/** Sample points on concentric rings around a centre point */
export function generateRingSamples(
  center: google.maps.LatLng,
  radii: number[],
  segmentsPerRing: number[]
): google.maps.LatLng[] {
  const pts: google.maps.LatLng[] = [];
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    const segs = Math.max(1, segmentsPerRing[i] ?? 8);
    if (r === 0) {
      pts.push(center);
      continue;
    }
    for (const brg of ringBearings(segs)) {
      pts.push(google.maps.geometry.spherical.computeOffset(center, r, brg));
    }
  }
  return pts;
}

/** 
 * Find a Street View panorama with ≥ minLinks, expanding outward until one is found.
 */
export async function findGoodPanorama(
  svs: google.maps.StreetViewService,
  target: google.maps.LatLng,
  options?: {
    radii?: number[];
    segmentsPerRing?: number[];
    panoLookupRadius?: number;
    minLinks?: number;
    maxPerBatch?: number;
  }
): Promise<google.maps.StreetViewPanoramaData | null> {
  const {
    radii = [0, 25, 50, 75, 100, 150, 200],
    segmentsPerRing = [1, 8, 8, 12, 12, 16, 16],
    panoLookupRadius = 50,
    minLinks = 2,
    maxPerBatch = 16,
  } = options || {};

  const samples = generateRingSamples(target, radii, segmentsPerRing);
  const copyrightRegex = /^©.*Google/;
	
  for (let i = 0; i < samples.length; i += maxPerBatch) {
    const batch = samples.slice(i, i + maxPerBatch);

    const results = await Promise.all(
      batch.map((pt) => getPanoramaByLocationAsync(svs, pt, panoLookupRadius))
    );

    const candidates: google.maps.StreetViewPanoramaData[] = [];
    for (const r of results) {
      if (r.status === google.maps.StreetViewStatus.OK && r.data?.location?.latLng) {
        const linksCount = r.data.links?.length ?? 0;
				const copyright = r.data.copyright ?? "";
				const matchesCopyright = copyrightRegex.test(copyright);
				
        if (linksCount >= minLinks && matchesCopyright) {
					candidates.push(r.data);
				}
      }
    }

    if (candidates.length) {
      candidates.sort((a, b) => {
        const la = a.location!.latLng!;
        const lb = b.location!.latLng!;
        const da = google.maps.geometry.spherical.computeDistanceBetween(la, target);
        const db = google.maps.geometry.spherical.computeDistanceBetween(lb, target);
        return da - db;
      });
      return candidates[0];
    }
  }

  const nearest = await getPanoramaByLocationAsync(svs, target, 50);
  return nearest.status === google.maps.StreetViewStatus.OK ? nearest.data : null;
}
