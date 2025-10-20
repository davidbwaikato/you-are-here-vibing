import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useRoutePolyline } from '@/hooks/useRoutePolyline';
import { interpolatePolyline, getVisibleMarkers } from '@/utils/geoUtils';
import { polylineTo3D } from '@/utils/coordinateConversion';
import { 
  MAX_INTERPOLATION_SPACING, 
  MIN_DISTANCE_MARKERS_FROM_USER, 
  MAX_DISTANCE_MARKERS_FROM_USER 
} from '@/utils/constants';
import * as THREE from 'three';

interface ThreeJsCanvasProps {
  isReady: boolean;
}

export const ThreeJsCanvas = ({ isReady }: ThreeJsCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const routeArrowsRef = useRef<THREE.Group[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Get Street View position, POV, zoom, and loaded state from Redux store
  const { position, pov, zoom, isLoaded: isStreetViewLoaded } = useSelector((state: RootState) => state.streetView);

  // Get route polyline from Redux
  const { routePolyline, hasRoute } = useRoutePolyline();

  // Initialize Three.js scene
  useEffect(() => {
    if (!isReady || !canvasRef.current) {
      console.log('[ThreeJS] Not ready to initialize:', { isReady, hasCanvas: !!canvasRef.current });
      return;
    }

    console.log('[ThreeJS] 🎨 Initializing Three.js scene...');

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    console.log('[ThreeJS] ✅ Scene created');

    // Create camera with perspective matching typical human FOV
    const camera = new THREE.PerspectiveCamera(
      75, // FOV
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    camera.position.set(0, 0, 0); // Camera at origin (user's position)
    cameraRef.current = camera;
    console.log('[ThreeJS] ✅ Camera created at origin');

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true, // Transparent background
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    console.log('[ThreeJS] ✅ Renderer created');

    // Add some lighting for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    console.log('[ThreeJS] ✅ Lighting added');

    // Animation loop - renders the scene
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    console.log('[ThreeJS] ✅ Animation loop started');
    console.log('[ThreeJS] 🎬 Three.js initialization complete');

    // Cleanup
    return () => {
      console.log('[ThreeJS] 🧹 Cleaning up Three.js resources...');
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up arrows
      routeArrowsRef.current.forEach(arrow => {
        arrow.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      routeArrowsRef.current = [];
    };
  }, [isReady]);

  // Create/update 3D route arrows when Street View position changes
  useEffect(() => {
    if (!sceneRef.current || !isStreetViewLoaded || !hasRoute) {
      console.log('[ThreeJS] Not ready to create route arrows:', {
        hasScene: !!sceneRef.current,
        isStreetViewLoaded,
        hasRoute,
      });
      return;
    }

    console.log('[ThreeJS] 🏹 Creating 3D directional arrows with interpolation + visibility filtering...');
    console.log('[ThreeJS] 📍 Current Street View position:', position);
    console.log('[ThreeJS] 🧭 Current Street View heading:', pov.heading.toFixed(1) + '°');
    console.log('[ThreeJS] ⚙️ Configuration:', {
      maxInterpolationSpacing: MAX_INTERPOLATION_SPACING + 'm',
      minDistanceFromUser: MIN_DISTANCE_MARKERS_FROM_USER + 'm',
      maxDistanceFromUser: MAX_DISTANCE_MARKERS_FROM_USER + 'm',
      userFOV: '75°',
    });

    // STAGE 1: INTERPOLATION
    // Add interpolation points to ensure consistent spacing (≤ MAX_INTERPOLATION_SPACING)
    console.log('[ThreeJS] 📊 STAGE 1: Interpolation');
    const interpolatedRoute = interpolatePolyline(routePolyline, MAX_INTERPOLATION_SPACING);
    
    console.log('[ThreeJS] ✅ Interpolation complete:', {
      originalPoints: interpolatedRoute.originalPointCount,
      addedPoints: interpolatedRoute.interpolatedPointCount,
      totalPoints: interpolatedRoute.points.length,
      totalDistance: interpolatedRoute.totalDistance.toFixed(2) + 'm',
    });

    // STAGE 2: VISIBILITY FILTERING (Distance + FOV)
    // Filter points to only show those within the visibility zone AND within user's FOV
    console.log('[ThreeJS] 📊 STAGE 2: Visibility Filtering (Distance + FOV)');
    const visibilityResult = getVisibleMarkers(
      interpolatedRoute.points,
      position,
      pov.heading,
      75, // User's horizontal FOV in degrees
      MIN_DISTANCE_MARKERS_FROM_USER,
      MAX_DISTANCE_MARKERS_FROM_USER
    );

    console.log('[ThreeJS] ✅ Visibility filtering complete:', {
      inputPoints: interpolatedRoute.points.length,
      visibleCount: visibilityResult.visibleCount,
      closestMarkerIndex: visibilityResult.closestMarkerIndex,
      closestMarkerDistance: visibilityResult.closestMarkerIndex >= 0 
        ? visibilityResult.visibleMarkers[visibilityResult.closestMarkerIndex].distance.toFixed(2) + 'm'
        : 'N/A',
      visibilityZone: `${MIN_DISTANCE_MARKERS_FROM_USER}m - ${MAX_DISTANCE_MARKERS_FROM_USER}m`,
      userFOV: '75°',
    });

    // Extract LatLng coordinates from visible markers
    const visiblePoints = visibilityResult.visibleMarkers.map(marker => 
      interpolatedRoute.points[marker.originalRouteIndex]
    );

    console.log('[ThreeJS] 📍 Extracted visible points:', {
      visiblePointsCount: visiblePoints.length,
    });

    if (visiblePoints.length < 2) {
      console.warn('[ThreeJS] ⚠️ Not enough visible points to create arrows');
      
      // Clean up existing arrows
      if (routeArrowsRef.current.length > 0) {
        routeArrowsRef.current.forEach(arrow => {
          sceneRef.current?.remove(arrow);
          arrow.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        });
        routeArrowsRef.current = [];
      }
      
      return;
    }

    // STAGE 3: 3D CONVERSION
    // Convert visible LatLng points to 3D coordinates
    console.log('[ThreeJS] 📊 STAGE 3: 3D Conversion');
    const polyline3D = polylineTo3D(visiblePoints, position);
    
    console.log('[ThreeJS] ✅ 3D conversion complete:', {
      points3D: polyline3D.points.length,
      totalLength3D: polyline3D.totalLength.toFixed(2) + 'm',
    });

    // STAGE 4: ARROW CREATION WITH COLOR DIFFERENTIATION
    // Remove existing arrows if present
    if (routeArrowsRef.current.length > 0) {
      routeArrowsRef.current.forEach(arrow => {
        sceneRef.current?.remove(arrow);
        arrow.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
      console.log('[ThreeJS] 🗑️ Removed previous route arrows:', routeArrowsRef.current.length);
      routeArrowsRef.current = [];
    }

    console.log('[ThreeJS] 📊 STAGE 4: Arrow Creation with Color Differentiation');

    // Create arrow geometry components
    const coneGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
    const cylinderGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    
    // Create materials for arrows
    const defaultArrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x14b8a6, // Teal color for default arrows
      transparent: true,
      opacity: 0.8,
      metalness: 0.3,
      roughness: 0.7,
    });

    const closestArrowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Red color for closest marker
      transparent: true,
      opacity: 0.9, // Slightly more opaque for emphasis
      metalness: 0.3,
      roughness: 0.7,
    });

    // Create arrows at each 3D point (except last - no next position)
    const newArrows: THREE.Group[] = [];
    let closestArrowCount = 0;
    let defaultArrowCount = 0;
    
    for (let i = 0; i < polyline3D.points.length - 1; i++) {
      const currentPoint = polyline3D.points[i];
      const nextPoint = polyline3D.points[i + 1];
      
      // Determine if this is the closest marker
      const isClosestMarker = i === visibilityResult.closestMarkerIndex;
      const arrowMaterial = isClosestMarker ? closestArrowMaterial : defaultArrowMaterial;
      
      if (isClosestMarker) {
        closestArrowCount++;
        console.log('[ThreeJS] 🔴 Creating RED arrow for closest marker at index:', i);
      } else {
        defaultArrowCount++;
      }
      
      // Create arrow group
      const arrowGroup = new THREE.Group();
      
      // Create cone and cylinder with appropriate material
      const cone = new THREE.Mesh(coneGeometry, arrowMaterial);
      const cylinder = new THREE.Mesh(cylinderGeometry, arrowMaterial);
      
      // Position cone at top of cylinder
      cone.position.y = 0.7;
      cylinder.position.y = 0;
      
      arrowGroup.add(cylinder);
      arrowGroup.add(cone);
      
      // Position arrow at current point
      arrowGroup.position.set(currentPoint.x, currentPoint.y, currentPoint.z);
      
      // Calculate direction vector
      const direction = new THREE.Vector3(
        nextPoint.x - currentPoint.x,
        nextPoint.y - currentPoint.y,
        nextPoint.z - currentPoint.z
      );
      direction.normalize();
      
      // Rotate arrow to point in direction of travel
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, direction);
      arrowGroup.setRotationFromQuaternion(quaternion);
      
      sceneRef.current?.add(arrowGroup);
      newArrows.push(arrowGroup);
    }

    routeArrowsRef.current = newArrows;
    
    console.log('[ThreeJS] ✅ 3D directional arrows created and added to scene:', {
      totalArrowCount: newArrows.length,
      closestArrowCount: closestArrowCount,
      defaultArrowCount: defaultArrowCount,
      closestMarkerColor: 'RED (#ff0000)',
      defaultMarkerColor: 'TEAL (#14b8a6)',
      dimensions: 'cone: 0.6m height, cylinder: 0.8m height',
      totalArrowHeight: '1.4m',
      visibilityZone: `${MIN_DISTANCE_MARKERS_FROM_USER}m - ${MAX_DISTANCE_MARKERS_FROM_USER}m from user`,
      maxSpacing: MAX_INTERPOLATION_SPACING + 'm between consecutive markers',
      userFOV: '75° horizontal field of view',
      closestMarkerInfo: visibilityResult.closestMarkerIndex >= 0 
        ? `Index ${visibilityResult.closestMarkerIndex} at ${visibilityResult.visibleMarkers[visibilityResult.closestMarkerIndex].distance.toFixed(2)}m`
        : 'N/A',
    });
    console.log('[ThreeJS] 🎨 Color Differentiation: Closest marker = RED, All others = TEAL');
    console.log('[ThreeJS] 🌍 Arrows are WORLD-SPACE anchored (update on position/heading change)');
    console.log('[ThreeJS] 🧭 Each arrow points toward the next route point');
    console.log('[ThreeJS] 📏 Three-stage processing: Interpolation → Visibility Filtering (Distance + FOV) → 3D Conversion');

  }, [isStreetViewLoaded, hasRoute, position, pov.heading, routePolyline]);

  // Synchronize Three.js camera rotation with Street View POV
  useEffect(() => {
    if (!cameraRef.current) return;

    // Convert Street View heading and pitch to Three.js Euler angles
    const headingRad = THREE.MathUtils.degToRad(pov.heading);
    const pitchRad = THREE.MathUtils.degToRad(pov.pitch);

    cameraRef.current.rotation.order = 'YXZ';
    cameraRef.current.rotation.y = -headingRad;
    cameraRef.current.rotation.x = pitchRad;

    console.log('[ThreeJS] 🔄 Camera rotation synced with Street View POV:', {
      heading: pov.heading,
      pitch: pov.pitch,
      rotationOrder: 'YXZ',
      xRotation: pitchRad,
      yRotation: -headingRad,
    });
  }, [pov]);

  // Synchronize Three.js camera FOV with Street View zoom
  useEffect(() => {
    if (!cameraRef.current) return;

    // Street View zoom range: typically 0 (zoomed out) to 4+ (zoomed in)
    // Three.js FOV: smaller FOV = more zoomed in (telephoto), larger FOV = zoomed out (wide angle)
    // Base FOV at zoom=1 is 75°, we'll scale inversely with zoom
    
    const baseFOV = 75; // Default FOV at zoom level 1
    const newFOV = baseFOV / zoom;
    
    // Clamp FOV to reasonable range (10° to 120°)
    const clampedFOV = Math.max(10, Math.min(120, newFOV));
    
    cameraRef.current.fov = clampedFOV;
    cameraRef.current.updateProjectionMatrix();

    console.log('[ThreeJS] 🔍 Camera FOV synced with Street View zoom:', {
      streetViewZoom: zoom,
      calculatedFOV: newFOV,
      clampedFOV: clampedFOV,
      note: 'Higher zoom = smaller FOV (more magnification)'
    });
  }, [zoom]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
      console.log('[ThreeJS] 📐 Canvas resized to:', width, 'x', height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 10, // Above Street View (0), below Video overlay (20)
        width: '100%',
        height: '100%',
      }}
    />
  );
};
