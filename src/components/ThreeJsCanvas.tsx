import { useEffect, useRef, useState } from 'react';
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

  // Mouse drag state
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number>(0);
  const selectedMarkerIndexRef = useRef<number>(0); // Ref for event handlers
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const accumulatedDragRef = useRef<number>(0);
  const visibleMarkersCountRef = useRef<number>(0);

  // Get Street View position, POV, zoom, and loaded state from Redux store
  const { position, pov, zoom, isLoaded: isStreetViewLoaded } = useSelector((state: RootState) => state.streetView);

  // Get route polyline from Redux
  const { routePolyline, hasRoute } = useRoutePolyline();

  // Sync ref with state
  useEffect(() => {
    selectedMarkerIndexRef.current = selectedMarkerIndex;
  }, [selectedMarkerIndex]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!isReady || !canvasRef.current) {
      return;
    }

    console.log('[ThreeJS] 🎨 Initializing Three.js scene...');

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create camera with perspective matching typical human FOV
    const camera = new THREE.PerspectiveCamera(
      75, // FOV
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    camera.position.set(0, 0, 0); // Camera at origin (user's position)
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true, // Transparent background
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Add some lighting for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Animation loop - renders the scene
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    console.log('[ThreeJS] ✅ Three.js initialization complete');

    // Cleanup
    return () => {
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

  // Setup middle-mouse drag navigation
  useEffect(() => {
    console.log('[ThreeJS] 🖱️ Setting up middle-mouse drag navigation...');

    const handleMouseDown = (event: MouseEvent) => {
      // Only handle middle-mouse button (button code 1)
      if (event.button !== 1) {
        return;
      }

      console.log('[ThreeJS] 🖱️ Middle-mouse button pressed - starting drag');
      isDraggingRef.current = true;
      dragStartYRef.current = event.clientY;
      accumulatedDragRef.current = 0;

      // Prevent default middle-mouse behavior (e.g., scroll mode)
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Only handle if middle-mouse drag is active
      if (!isDraggingRef.current) {
        return;
      }

      console.log('[ThreeJS] 🖱️ MouseMove during drag:', {
        clientY: event.clientY,
        buttons: event.buttons,
      });

      // Calculate vertical movement since drag start
      const deltaY = dragStartYRef.current - event.clientY; // Positive = drag up, Negative = drag down
      accumulatedDragRef.current += deltaY;
      dragStartYRef.current = event.clientY;

      console.log('[ThreeJS] 🖱️ Drag calculation:', {
        deltaY: deltaY.toFixed(1) + 'px',
        accumulated: accumulatedDragRef.current.toFixed(1) + 'px',
      });

      // Check if we've accumulated enough movement (50 pixels = 1 marker step)
      const DRAG_THRESHOLD = 50;
      const markerSteps = Math.floor(Math.abs(accumulatedDragRef.current) / DRAG_THRESHOLD);

      if (markerSteps > 0) {
        const direction = accumulatedDragRef.current > 0 ? 1 : -1; // Positive = forward, Negative = backward
        const newIndex = selectedMarkerIndexRef.current + (direction * markerSteps);

        // Clamp to valid range [0, visibleMarkersCount - 1]
        const clampedIndex = Math.max(0, Math.min(visibleMarkersCountRef.current - 1, newIndex));

        console.log('[ThreeJS] 🖱️ Marker selection changed:', {
          previousIndex: selectedMarkerIndexRef.current,
          newIndex: clampedIndex,
          direction: direction > 0 ? 'FORWARD' : 'BACKWARD',
          markerSteps,
        });

        setSelectedMarkerIndex(clampedIndex);

        // Reset accumulated drag after applying steps
        accumulatedDragRef.current = accumulatedDragRef.current % DRAG_THRESHOLD;
      }

      // Prevent default to avoid unwanted scrolling
      event.preventDefault();
    };

    const handleMouseUp = (event: MouseEvent) => {
      // Only handle middle-mouse button
      if (event.button !== 1) {
        return;
      }

      if (isDraggingRef.current) {
        console.log('[ThreeJS] 🖱️ Middle-mouse button released - ending drag');
        isDraggingRef.current = false;
        accumulatedDragRef.current = 0;

        // Prevent default
        event.preventDefault();
      }
    };

    // Add event listeners to document for global interaction
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // No dependencies - use refs for current values

  // Create/update 3D route arrows when Street View position changes OR selected marker changes
  useEffect(() => {
    if (!sceneRef.current || !isStreetViewLoaded || !hasRoute) {
      return;
    }

    console.log('[ThreeJS] 🏹 Creating 3D directional arrows...');

    // STAGE 1: INTERPOLATION
    const interpolatedRoute = interpolatePolyline(routePolyline, MAX_INTERPOLATION_SPACING);

    // STAGE 2: VISIBILITY FILTERING (Distance + FOV)
    const visibilityResult = getVisibleMarkers(
      interpolatedRoute.points,
      position,
      pov.heading,
      75, // User's horizontal FOV in degrees
      MIN_DISTANCE_MARKERS_FROM_USER,
      MAX_DISTANCE_MARKERS_FROM_USER
    );

    // Update visible markers count for drag navigation
    visibleMarkersCountRef.current = visibilityResult.visibleCount;

    // Initialize selected marker to closest marker on first load
    if (visibilityResult.closestMarkerIndex >= 0 && selectedMarkerIndex === 0) {
      setSelectedMarkerIndex(visibilityResult.closestMarkerIndex);
    }

    // Extract LatLng coordinates from visible markers
    const visiblePoints = visibilityResult.visibleMarkers.map(marker => 
      interpolatedRoute.points[marker.originalRouteIndex]
    );

    if (visiblePoints.length < 2) {
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
    const polyline3D = polylineTo3D(visiblePoints, position);

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
      routeArrowsRef.current = [];
    }

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

    const selectedArrowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Red color for selected marker
      transparent: true,
      opacity: 0.9, // Slightly more opaque for emphasis
      metalness: 0.3,
      roughness: 0.7,
    });

    // Create arrows at each 3D point (except last - no next position)
    const newArrows: THREE.Group[] = [];
    
    for (let i = 0; i < polyline3D.points.length - 1; i++) {
      const currentPoint = polyline3D.points[i];
      const nextPoint = polyline3D.points[i + 1];
      
      // Determine if this is the selected marker
      const isSelectedMarker = i === selectedMarkerIndex;
      const arrowMaterial = isSelectedMarker ? selectedArrowMaterial : defaultArrowMaterial;
      
      if (isSelectedMarker) {
        console.log('[ThreeJS] 🔴 Creating RED arrow for selected marker at index:', i);
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
    
    console.log('[ThreeJS] ✅ Arrows created:', {
      totalCount: newArrows.length,
      selectedIndex: selectedMarkerIndex,
    });

  }, [isStreetViewLoaded, hasRoute, position, pov.heading, routePolyline, selectedMarkerIndex]); // Added selectedMarkerIndex

  // Synchronize Three.js camera rotation with Street View POV
  useEffect(() => {
    if (!cameraRef.current) return;

    // Convert Street View heading and pitch to Three.js Euler angles
    const headingRad = THREE.MathUtils.degToRad(pov.heading);
    const pitchRad = THREE.MathUtils.degToRad(pov.pitch);

    cameraRef.current.rotation.order = 'YXZ';
    cameraRef.current.rotation.y = -headingRad;
    cameraRef.current.rotation.x = pitchRad;
  }, [pov]);

  // Synchronize Three.js camera FOV with Street View zoom
  useEffect(() => {
    if (!cameraRef.current) return;

    const baseFOV = 75;
    const newFOV = baseFOV / zoom;
    const clampedFOV = Math.max(10, Math.min(120, newFOV));
    
    cameraRef.current.fov = clampedFOV;
    cameraRef.current.updateProjectionMatrix();
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
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 10,
        width: '100%',
        height: '100%',
      }}
    />
  );
};
