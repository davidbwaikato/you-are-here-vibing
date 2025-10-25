import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setSelectedMarkerIndex } from '@/store/streetViewSlice';
import { useRoutePolyline } from '@/hooks/useRoutePolyline';
import { interpolatePolyline, getVisibleMarkers } from '@/utils/geoUtils';
import { polylineTo3D, latLngTo3D } from '@/utils/coordinateConversion';
import { 
  MAX_INTERPOLATION_SPACING, 
  MIN_DISTANCE_MARKERS_FROM_USER, 
  MAX_DISTANCE_MARKERS_FROM_USER 
} from '@/utils/constants';
import * as THREE from 'three';

interface ThreeJsCanvasProps {
  isReady: boolean;
  onTeleportToMarker?: (markerIndex: number) => void;
}

interface ArrowAnimationState {
  group: THREE.Group;
  currentScale: number;
  targetScale: number;
  isAnimating: boolean;
  coneMaterial: THREE.MeshStandardMaterial;
  cylinderMaterial: THREE.MeshStandardMaterial;
  scaleTimeoutId?: number;
}

interface LocationCuboid {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  type: 'source' | 'destination';
}

// Street View eye level is approximately 1.7 meters above ground
const STREET_VIEW_EYE_LEVEL = 1.7;

export const ThreeJsCanvas = ({ isReady, onTeleportToMarker }: ThreeJsCanvasProps) => {
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const routeArrowsRef = useRef<ArrowAnimationState[]>([]);
  const locationCuboidsRef = useRef<LocationCuboid[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Mouse drag state
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const accumulatedDragRef = useRef<number>(0);
  const visibleMarkersCountRef = useRef<number>(0);

  // Store visible markers for teleport feature
  const visibleMarkersRef = useRef<Array<{ lat: number; lng: number; heading: number }>>([]);

  // Track previous position to detect teleports
  const previousPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Track if initial markers have been created
  const initialMarkersCreatedRef = useRef<boolean>(false);

  // Get Street View position, POV, zoom, loaded state, and selected marker from Redux store
  const { position, pov, zoom, isLoaded: isStreetViewLoaded, selectedMarkerIndex, isFistTrackingActive, sourceLocation, destinationLocation } = useSelector((state: RootState) => state.streetView);

  // Get route polyline from Redux
  const { routePolyline, hasRoute } = useRoutePolyline();

  // Expose teleport function via callback
  useEffect(() => {
    if (onTeleportToMarker) {
      // Store the teleport function reference
      const teleportFunction = (markerIndex: number) => {
        console.log('[ThreeJS] 🚀 Teleport function called with markerIndex:', markerIndex);
        performTeleport('CALLBACK', markerIndex);
      };
      
      // Pass the function to parent via callback
      onTeleportToMarker(teleportFunction as any);
    }
  }, [onTeleportToMarker]);

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
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Update arrow scale animations AND distance-based opacity
      routeArrowsRef.current.forEach(arrowState => {
        // SCALE ANIMATION
        if (arrowState.isAnimating) {
          const diff = arrowState.targetScale - arrowState.currentScale;
          const threshold = 0.001;
          
          if (Math.abs(diff) > threshold) {
            const lerpFactor = 0.15;
            arrowState.currentScale += diff * lerpFactor;
            
            arrowState.group.scale.set(
              arrowState.currentScale,
              arrowState.currentScale,
              arrowState.currentScale
            );
          } else {
            arrowState.currentScale = arrowState.targetScale;
            arrowState.group.scale.set(
              arrowState.targetScale,
              arrowState.targetScale,
              arrowState.targetScale
            );
            arrowState.isAnimating = false;
          }
        }

        // DISTANCE-BASED OPACITY UPDATE
        const arrowPosition = arrowState.group.position;
        const distance = Math.sqrt(
          arrowPosition.x * arrowPosition.x +
          arrowPosition.y * arrowPosition.y +
          arrowPosition.z * arrowPosition.z
        );

        let opacity: number;
        if (distance <= 5) {
          opacity = 0.7;
        } else if (distance >= 35) {
          opacity = 1.0;
        } else {
          opacity = 0.7 + ((distance - 5) / 10) * 0.1;
        }

        opacity = Math.max(0.7, Math.min(1.0, opacity));

        arrowState.coneMaterial.opacity = opacity;
        arrowState.cylinderMaterial.opacity = opacity;
      });

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    console.log('[ThreeJS] ✅ Three.js initialization complete with animation loop');

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      routeArrowsRef.current.forEach(arrowState => {
        if (arrowState.scaleTimeoutId !== undefined) {
          clearTimeout(arrowState.scaleTimeoutId);
        }
        
        arrowState.group.traverse((child) => {
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

      locationCuboidsRef.current.forEach(cuboid => {
        cuboid.mesh.geometry.dispose();
        cuboid.material.dispose();
      });

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      routeArrowsRef.current = [];
      locationCuboidsRef.current = [];
      initialMarkersCreatedRef.current = false;
    };
  }, [isReady]);

  // Shared teleport logic
  const performTeleport = (triggerSource: 'ENTER_KEY' | 'MIDDLE_MOUSE_RELEASE' | 'CALLBACK', markerIndexOverride?: number) => {
    const markerIndex = markerIndexOverride !== undefined ? markerIndexOverride : selectedMarkerIndex;
    
    console.log(`[ThreeJS] 🚀 Teleport triggered by: ${triggerSource}`, {
      markerIndex,
      isOverride: markerIndexOverride !== undefined,
    });

    // Check if we have visible markers
    if (visibleMarkersRef.current.length === 0) {
      console.log('[ThreeJS] ⚠️ Cannot teleport - no visible markers available');
      return false;
    }

    // Check if we have a valid selected marker
    if (markerIndex < 0 || markerIndex >= visibleMarkersRef.current.length) {
      console.log('[ThreeJS] ⚠️ Cannot teleport - invalid marker index:', {
        selectedIndex: markerIndex,
        availableMarkers: visibleMarkersRef.current.length,
      });
      return false;
    }

    const selectedMarker = visibleMarkersRef.current[markerIndex];

    console.log('[ThreeJS] 🚀 TELEPORTING to marker:', {
      triggerSource,
      index: markerIndex,
      totalMarkers: visibleMarkersRef.current.length,
      position: { lat: selectedMarker.lat, lng: selectedMarker.lng },
      heading: selectedMarker.heading,
      markerData: selectedMarker,
    });

    // CRITICAL FIX: Dispatch setPosition IMMEDIATELY to trigger geocoding
    console.log('[ThreeJS] 📤 IMMEDIATELY dispatching setPosition to Redux:', { 
      lat: selectedMarker.lat, 
      lng: selectedMarker.lng 
    });
    
    dispatch(setPosition({ 
      lat: selectedMarker.lat, 
      lng: selectedMarker.lng 
    }));

    console.log('[ThreeJS] 📤 Dispatching setPov with:', { 
      heading: selectedMarker.heading, 
      pitch: 0 
    });
    
    dispatch(setPov({ 
      heading: selectedMarker.heading, 
      pitch: 0
    }));

    return true;
  };

  // Setup middle-mouse drag navigation and release teleport
  useEffect(() => {
    console.log('[ThreeJS] 🖱️ Setting up middle-mouse drag navigation and release teleport...');

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) {
        return;
      }

      console.log('[ThreeJS] 🖱️ Middle-mouse button pressed - starting drag');
      isDraggingRef.current = true;
      dragStartYRef.current = event.clientY;
      accumulatedDragRef.current = 0;

      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      const deltaY = dragStartYRef.current - event.clientY;
      accumulatedDragRef.current += deltaY;
      dragStartYRef.current = event.clientY;

      const DRAG_THRESHOLD = 50;
      const markerSteps = Math.floor(Math.abs(accumulatedDragRef.current) / DRAG_THRESHOLD);

      if (markerSteps > 0) {
        const direction = accumulatedDragRef.current > 0 ? 1 : -1;
        const newIndex = selectedMarkerIndex + (direction * markerSteps);

        const clampedIndex = Math.max(0, Math.min(visibleMarkersCountRef.current - 1, newIndex));

        console.log('[ThreeJS] 🖱️ Marker selection changed:', {
          previousIndex: selectedMarkerIndex,
          newIndex: clampedIndex,
          direction: direction > 0 ? 'FORWARD' : 'BACKWARD',
          markerSteps,
        });

        dispatch(setSelectedMarkerIndex(clampedIndex));

        accumulatedDragRef.current = accumulatedDragRef.current % DRAG_THRESHOLD;
      }

      event.preventDefault();
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 1) {
        return;
      }

      if (isDraggingRef.current) {
        console.log('[ThreeJS] 🖱️ Middle-mouse button released - ending drag');
        isDraggingRef.current = false;
        accumulatedDragRef.current = 0;

        if (selectedMarkerIndex !== 0) {
          console.log('[ThreeJS] 🖱️ Selected marker is NOT closest - triggering teleport on release:', {
            selectedIndex: selectedMarkerIndex,
            closestIndex: 0,
          });
          
          performTeleport('MIDDLE_MOUSE_RELEASE');
        } else {
          console.log('[ThreeJS] 🖱️ Selected marker IS closest - skipping teleport on release:', {
            selectedIndex: selectedMarkerIndex,
          });
        }

        event.preventDefault();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dispatch, selectedMarkerIndex]);

  // Setup Enter key teleport feature
  useEffect(() => {
    console.log('[ThreeJS] ⌨️ Setting up Enter key teleport...');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') {
        return;
      }

      console.log('[ThreeJS] ⌨️ Enter key detected! Starting teleport...');

      const success = performTeleport('ENTER_KEY');
      
      if (success) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    console.log('[ThreeJS] ✅ Enter key listener attached to document');

    return () => {
      console.log('[ThreeJS] 🧹 Removing Enter key listener');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, selectedMarkerIndex]);

  // Detect position changes and reset selected marker to closest
  useEffect(() => {
    if (!previousPositionRef.current) {
      console.log('[ThreeJS] 📍 First position recorded:', position);
      previousPositionRef.current = position;
      return;
    }

    const positionChanged = 
      previousPositionRef.current.lat !== position.lat ||
      previousPositionRef.current.lng !== position.lng;

    if (positionChanged) {
      console.log('[ThreeJS] 🔄 POSITION CHANGED - Resetting selected marker to closest:', {
        previousPosition: previousPositionRef.current,
        newPosition: position,
        previousSelectedIndex: selectedMarkerIndex,
      });

      dispatch(setSelectedMarkerIndex(0));
      console.log('[ThreeJS] ✅ Selected marker reset to index 0 (closest)');

      previousPositionRef.current = position;
      
      // Reset initial markers flag when position changes (e.g., teleport)
      initialMarkersCreatedRef.current = false;
    }
  }, [position, dispatch]);

  /**
   * Helper function to compare two marker arrays for equality
   * Returns true if markers are identical (same positions and headings in same order)
   */
  const areMarkersEqual = (
    markers1: Array<{ lat: number; lng: number; heading: number }>,
    markers2: Array<{ lat: number; lng: number; heading: number }>
  ): boolean => {
    if (markers1.length !== markers2.length) {
      return false;
    }

    for (let i = 0; i < markers1.length; i++) {
      const m1 = markers1[i];
      const m2 = markers2[i];
      
      // Compare with small epsilon for floating point precision
      const EPSILON = 0.000001;
      
      if (
        Math.abs(m1.lat - m2.lat) > EPSILON ||
        Math.abs(m1.lng - m2.lng) > EPSILON ||
        Math.abs(m1.heading - m2.heading) > EPSILON
      ) {
        return false;
      }
    }

    return true;
  };

  // Create/update location cuboids when source/destination locations change
  useEffect(() => {
    if (!sceneRef.current || !isStreetViewLoaded) {
      console.log('[ThreeJS] ⏸️ Skipping location cuboid update - conditions not met:', {
        hasScene: !!sceneRef.current,
        isStreetViewLoaded,
      });
      return;
    }

    console.log('[ThreeJS] 🟧 Updating location cuboids...', {
      sourceLocation,
      destinationLocation,
      currentPosition: position,
    });

    // Clean up existing cuboids
    if (locationCuboidsRef.current.length > 0) {
      console.log('[ThreeJS] 🧹 Cleaning up existing location cuboids...');
      locationCuboidsRef.current.forEach(cuboid => {
        sceneRef.current?.remove(cuboid.mesh);
        cuboid.mesh.geometry.dispose();
        cuboid.material.dispose();
      });
      locationCuboidsRef.current = [];
    }

    const newCuboids: LocationCuboid[] = [];

    // Create cuboid geometry (20x20x8 - width x depth x height)
    const cuboidGeometry = new THREE.BoxGeometry(20, 8, 20);
    
    // Semi-translucent amber material
    const createCuboidMaterial = () => new THREE.MeshStandardMaterial({
      color: 0xffbf00, // Amber color
      transparent: true,
      opacity: 0.5,
      metalness: 0.2,
      roughness: 0.8,
      depthWrite: false,
    });

    // Helper function to check if location is within catchment area
    const isLocationInCatchment = (location: { lat: number; lng: number }): boolean => {
      const point3D = latLngTo3D(location, position);
      const distance = Math.sqrt(
        point3D.x * point3D.x +
        point3D.z * point3D.z
      );
      
      // Within catchment area (no minimum distance exclusion for cuboids)
      return distance <= MAX_DISTANCE_MARKERS_FROM_USER;
    };

    // Create source location cuboid
    if (sourceLocation && isLocationInCatchment(sourceLocation)) {
      console.log('[ThreeJS] 🟧 Creating SOURCE location cuboid:', sourceLocation);
      
      const point3D = latLngTo3D(sourceLocation, position);
      const material = createCuboidMaterial();
      const mesh = new THREE.Mesh(cuboidGeometry, material);
      
      // Position at ground level (compensate for Street View eye level)
      // Street View eye level is at y=0, so ground is at y=-STREET_VIEW_EYE_LEVEL
      // Cuboid height is 8, so center it at ground + half height
      mesh.position.set(
        point3D.x,
        -STREET_VIEW_EYE_LEVEL + 4, // Ground level + half of cuboid height (8/2 = 4)
        point3D.z
      );
      
      sceneRef.current?.add(mesh);
      newCuboids.push({ mesh, material, type: 'source' });
      
      console.log('[ThreeJS] ✅ Source cuboid created at:', {
        position: mesh.position,
        distance: Math.sqrt(point3D.x * point3D.x + point3D.z * point3D.z).toFixed(2) + 'm',
        dimensions: '20x20x8',
      });
    } else if (sourceLocation) {
      console.log('[ThreeJS] ⏸️ Source location outside catchment area:', {
        location: sourceLocation,
        maxDistance: MAX_DISTANCE_MARKERS_FROM_USER,
      });
    }

    // Create destination location cuboid
    if (destinationLocation && isLocationInCatchment(destinationLocation)) {
      console.log('[ThreeJS] 🟧 Creating DESTINATION location cuboid:', destinationLocation);
      
      const point3D = latLngTo3D(destinationLocation, position);
      const material = createCuboidMaterial();
      const mesh = new THREE.Mesh(cuboidGeometry, material);
      
      // Position at ground level (compensate for Street View eye level)
      mesh.position.set(
        point3D.x,
        -STREET_VIEW_EYE_LEVEL + 4, // Ground level + half of cuboid height (8/2 = 4)
        point3D.z
      );
      
      sceneRef.current?.add(mesh);
      newCuboids.push({ mesh, material, type: 'destination' });
      
      console.log('[ThreeJS] ✅ Destination cuboid created at:', {
        position: mesh.position,
        distance: Math.sqrt(point3D.x * point3D.x + point3D.z * point3D.z).toFixed(2) + 'm',
        dimensions: '20x20x8',
      });
    } else if (destinationLocation) {
      console.log('[ThreeJS] ⏸️ Destination location outside catchment area:', {
        location: destinationLocation,
        maxDistance: MAX_DISTANCE_MARKERS_FROM_USER,
      });
    }

    locationCuboidsRef.current = newCuboids;
    
    console.log('[ThreeJS] ✅ Location cuboids update complete:', {
      totalCuboids: newCuboids.length,
      types: newCuboids.map(c => c.type),
    });

  }, [isStreetViewLoaded, position, sourceLocation, destinationLocation]);

  // Create/update 3D route arrows when Street View position changes OR selected marker changes
  useEffect(() => {
    if (!sceneRef.current || !isStreetViewLoaded || !hasRoute) {
      console.log('[ThreeJS] ⏸️ Skipping marker update - conditions not met:', {
        hasScene: !!sceneRef.current,
        isStreetViewLoaded,
        hasRoute,
      });
      return;
    }

    console.log('[ThreeJS] 🔍 Recalculating visible 3D markers...', {
      isInitialLoad: !initialMarkersCreatedRef.current,
      currentPosition: position,
      currentHeading: pov.heading,
    });

    const interpolatedRoute = interpolatePolyline(routePolyline, MAX_INTERPOLATION_SPACING);

    const visibilityResult = getVisibleMarkers(
      interpolatedRoute.points,
      position,
      pov.heading,
      75,
      MIN_DISTANCE_MARKERS_FROM_USER,
      MAX_DISTANCE_MARKERS_FROM_USER
    );

    visibleMarkersCountRef.current = visibilityResult.visibleCount;

    const visiblePoints = visibilityResult.visibleMarkers.map(marker => 
      interpolatedRoute.points[marker.originalRouteIndex]
    );

    // Calculate new markers with heading
    const newMarkersWithHeading: Array<{ lat: number; lng: number; heading: number }> = [];
    for (let i = 0; i < visiblePoints.length - 1; i++) {
      const currentPoint = visiblePoints[i];
      const nextPoint = visiblePoints[i + 1];
      
      const heading = google.maps.geometry.spherical.computeHeading(
        new google.maps.LatLng(currentPoint.lat, currentPoint.lng),
        new google.maps.LatLng(nextPoint.lat, nextPoint.lng)
      );
      
      newMarkersWithHeading.push({
        lat: currentPoint.lat,
        lng: currentPoint.lng,
        heading: heading,
      });
    }

    // OPTIMIZATION: Compare new markers with existing markers
    // BUT: Always create markers on initial load (when initialMarkersCreatedRef is false)
    const markersChanged = !areMarkersEqual(newMarkersWithHeading, visibleMarkersRef.current);
    const isInitialLoad = !initialMarkersCreatedRef.current;

    if (!markersChanged && !isInitialLoad) {
      console.log('[ThreeJS] ✅ Visible markers UNCHANGED - skipping route arrow regeneration', {
        markerCount: newMarkersWithHeading.length,
        selectedIndex: selectedMarkerIndex,
        optimization: 'SKIPPED arrow regeneration to prevent animation interruption',
      });
      
      // Early return - no need to regenerate arrows
      return;
    }

    if (isInitialLoad) {
      console.log('[ThreeJS] 🎬 INITIAL LOAD - Creating markers for first time', {
        markerCount: newMarkersWithHeading.length,
        position,
        heading: pov.heading,
      });
    } else {
      console.log('[ThreeJS] 🔄 Visible markers CHANGED - regenerating route arrows', {
        previousCount: visibleMarkersRef.current.length,
        newCount: newMarkersWithHeading.length,
        selectedIndex: selectedMarkerIndex,
        reason: 'Marker set differs from previous',
      });
    }

    // Update visibleMarkersRef with new markers
    visibleMarkersRef.current = newMarkersWithHeading;
    
    // Mark that initial markers have been created
    if (isInitialLoad) {
      initialMarkersCreatedRef.current = true;
      console.log('[ThreeJS] ✅ Initial markers created flag set to true');
    }
    
    console.log('[ThreeJS] 📊 Updated visible markers data:', {
      count: newMarkersWithHeading.length,
      firstMarker: newMarkersWithHeading[0],
      selectedIndex: selectedMarkerIndex,
      selectedMarker: newMarkersWithHeading[selectedMarkerIndex],
      closestMarkerDistance: visibilityResult.visibleMarkers[0]?.distance,
      isFistTrackingActive,
      isInitialLoad,
    });

    if (visiblePoints.length < 2) {
      if (routeArrowsRef.current.length > 0) {
        console.log('[ThreeJS] 🧹 Cleaning up arrows and cancelling pending animations...');
        routeArrowsRef.current.forEach(arrowState => {
          if (arrowState.scaleTimeoutId !== undefined) {
            clearTimeout(arrowState.scaleTimeoutId);
          }
          
          sceneRef.current?.remove(arrowState.group);
          arrowState.group.traverse((child) => {
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

    const polyline3D = polylineTo3D(visiblePoints, position);

    // Clamp selectedMarkerIndex to valid range
    const clampedSelectedIndex = Math.max(0, Math.min(selectedMarkerIndex, polyline3D.points.length - 2));
    if (clampedSelectedIndex !== selectedMarkerIndex) {
      console.log('[ThreeJS] ⚠️ Clamping selectedMarkerIndex:', {
        original: selectedMarkerIndex,
        clamped: clampedSelectedIndex,
        maxIndex: polyline3D.points.length - 2,
      });
      dispatch(setSelectedMarkerIndex(clampedSelectedIndex));
    }

    if (routeArrowsRef.current.length > 0) {
      routeArrowsRef.current.forEach(arrowState => {
        if (arrowState.scaleTimeoutId !== undefined) {
          clearTimeout(arrowState.scaleTimeoutId);
        }
        
        sceneRef.current?.remove(arrowState.group);
        arrowState.group.traverse((child) => {
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

    const coneGeometry = new THREE.ConeGeometry(0.3, 0.6, 32, 1);
    const cylinderGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 32, 1);

    const newArrows: ArrowAnimationState[] = [];
    
    for (let i = 0; i < polyline3D.points.length - 1; i++) {
      const currentPoint = polyline3D.points[i];
      const nextPoint = polyline3D.points[i + 1];
      
      const isSelectedMarker = i === clampedSelectedIndex;
      
      const coneMaterial = new THREE.MeshStandardMaterial({
        color: isSelectedMarker ? 0xff0000 : 0x14b8a6,
        transparent: true,
        opacity: 0.8,
        metalness: 0.3,
        roughness: 0.7,
        depthWrite: false,
      });

      const cylinderMaterial = new THREE.MeshStandardMaterial({
        color: isSelectedMarker ? 0xff0000 : 0x14b8a6,
        transparent: true,
        opacity: 0.8,
        metalness: 0.3,
        roughness: 0.7,
        depthWrite: false,
      });
      
      const arrowGroup = new THREE.Group();
      
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      
      cone.position.y = 0.7;
      cylinder.position.y = 0;
      
      arrowGroup.add(cylinder);
      arrowGroup.add(cone);
      
      arrowGroup.position.set(currentPoint.x, currentPoint.y, currentPoint.z);
      
      const currentScale = 1.0;
      
      arrowGroup.scale.set(currentScale, currentScale, currentScale);
      
      const arrowState: ArrowAnimationState = {
        group: arrowGroup,
        currentScale: currentScale,
        targetScale: 1.0,
        isAnimating: false,
        coneMaterial: coneMaterial,
        cylinderMaterial: cylinderMaterial,
        scaleTimeoutId: undefined,
      };
      
      if (isSelectedMarker) {
        const timeoutId = window.setTimeout(() => {
          arrowState.targetScale = 2.0;
          arrowState.isAnimating = true;
          arrowState.scaleTimeoutId = undefined;
        }, 500);
        
        arrowState.scaleTimeoutId = timeoutId;
      }
      
      const direction = new THREE.Vector3(
        nextPoint.x - currentPoint.x,
        nextPoint.y - currentPoint.y,
        nextPoint.z - currentPoint.z
      );
      direction.normalize();
      
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, direction);
      arrowGroup.setRotationFromQuaternion(quaternion);
      
      sceneRef.current?.add(arrowGroup);
      newArrows.push(arrowState);
    }

    routeArrowsRef.current = newArrows;

  }, [isStreetViewLoaded, hasRoute, position, pov.heading, routePolyline, selectedMarkerIndex, dispatch, isFistTrackingActive]);

  // Update arrow animations when selected marker changes
  useEffect(() => {
    if (routeArrowsRef.current.length === 0) {
      return;
    }

    routeArrowsRef.current.forEach((arrowState, index) => {
      const isSelected = index === selectedMarkerIndex;
      const newColor = isSelected ? 0xff0000 : 0x14b8a6;
      
      arrowState.coneMaterial.color.setHex(newColor);
      arrowState.cylinderMaterial.color.setHex(newColor);
      
      if (arrowState.scaleTimeoutId !== undefined) {
        clearTimeout(arrowState.scaleTimeoutId);
        arrowState.scaleTimeoutId = undefined;
      }
      
      if (isSelected) {
        const timeoutId = window.setTimeout(() => {
          arrowState.targetScale = 2.0;
          arrowState.isAnimating = true;
          arrowState.scaleTimeoutId = undefined;
        }, 500);
        
        arrowState.scaleTimeoutId = timeoutId;
      } else {
        if (arrowState.targetScale !== 1.0) {
          arrowState.targetScale = 1.0;
          arrowState.isAnimating = true;
        }
      }
    });

  }, [selectedMarkerIndex, isFistTrackingActive]);

  // Synchronize Three.js camera rotation with Street View POV
  useEffect(() => {
    if (!cameraRef.current) return;

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
