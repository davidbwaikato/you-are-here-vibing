import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov } from '@/store/streetViewSlice';
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

interface ArrowAnimationState {
  group: THREE.Group;
  currentScale: number;
  targetScale: number;
  isAnimating: boolean;
  coneMaterial: THREE.MeshStandardMaterial;
  cylinderMaterial: THREE.MeshStandardMaterial;
  scaleTimeoutId?: number; // Timeout ID for delayed scaling animation
}

export const ThreeJsCanvas = ({ isReady }: ThreeJsCanvasProps) => {
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const routeArrowsRef = useRef<ArrowAnimationState[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Mouse drag state
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number>(0);
  const selectedMarkerIndexRef = useRef<number>(0); // Ref for event handlers
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const accumulatedDragRef = useRef<number>(0);
  const visibleMarkersCountRef = useRef<number>(0);

  // Store visible markers for teleport feature
  const visibleMarkersRef = useRef<Array<{ lat: number; lng: number; heading: number }>>([]);

  // Track previous position to detect teleports
  const previousPositionRef = useRef<{ lat: number; lng: number } | null>(null);

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

    // Animation loop - renders the scene AND handles scale animations AND opacity updates
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Update arrow scale animations AND distance-based opacity
      let hasActiveAnimations = false;
      routeArrowsRef.current.forEach(arrowState => {
        // SCALE ANIMATION
        if (arrowState.isAnimating) {
          const diff = arrowState.targetScale - arrowState.currentScale;
          const threshold = 0.001; // Stop animating when very close to target
          
          if (Math.abs(diff) > threshold) {
            // Lerp towards target scale with smooth easing
            const lerpFactor = 0.15; // Higher = faster animation (0.1-0.2 is good range)
            arrowState.currentScale += diff * lerpFactor;
            
            // Apply current scale to arrow group
            arrowState.group.scale.set(
              arrowState.currentScale,
              arrowState.currentScale,
              arrowState.currentScale
            );
            
            hasActiveAnimations = true;
          } else {
            // Animation complete - snap to target and stop animating
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
        // Calculate distance from camera (user position at origin) to arrow
        const arrowPosition = arrowState.group.position;
        const distance = Math.sqrt(
          arrowPosition.x * arrowPosition.x +
          arrowPosition.y * arrowPosition.y +
          arrowPosition.z * arrowPosition.z
        );

        // Apply opacity mapping:
        // 5m = 70% (0.7)
        // +10% per 10m
        // 35m+ = 100% (1.0)
        let opacity: number;
        if (distance <= 5) {
          opacity = 0.7;
        } else if (distance >= 35) {
          opacity = 1.0;
        } else {
          // Linear interpolation: 0.7 + (distance - 5) / 10 * 0.1
          opacity = 0.7 + ((distance - 5) / 10) * 0.1;
        }

        // Clamp to valid range [0.7, 1.0]
        opacity = Math.max(0.7, Math.min(1.0, opacity));

        // Apply opacity to both cone and cylinder materials
        arrowState.coneMaterial.opacity = opacity;
        arrowState.cylinderMaterial.opacity = opacity;
      });

      if (hasActiveAnimations) {
        console.log('[ThreeJS] 🎬 Animating arrow scales...');
      }

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

      // Clean up arrows and their pending timeouts
      routeArrowsRef.current.forEach(arrowState => {
        // Clear any pending scale animation timeouts
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

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      routeArrowsRef.current = [];
    };
  }, [isReady]);

  // Shared teleport logic
  const performTeleport = (triggerSource: 'ENTER_KEY' | 'MIDDLE_MOUSE_RELEASE') => {
    console.log(`[ThreeJS] 🚀 Teleport triggered by: ${triggerSource}`);

    // Check if we have visible markers
    if (visibleMarkersRef.current.length === 0) {
      console.log('[ThreeJS] ⚠️ Cannot teleport - no visible markers available');
      return false;
    }

    // Check if we have a valid selected marker
    if (selectedMarkerIndexRef.current < 0 || 
        selectedMarkerIndexRef.current >= visibleMarkersRef.current.length) {
      console.log('[ThreeJS] ⚠️ Cannot teleport - invalid marker index:', {
        selectedIndex: selectedMarkerIndexRef.current,
        availableMarkers: visibleMarkersRef.current.length,
      });
      return false;
    }

    const selectedMarker = visibleMarkersRef.current[selectedMarkerIndexRef.current];

    console.log('[ThreeJS] 🚀 TELEPORTING to marker:', {
      triggerSource,
      index: selectedMarkerIndexRef.current,
      totalMarkers: visibleMarkersRef.current.length,
      position: { lat: selectedMarker.lat, lng: selectedMarker.lng },
      heading: selectedMarker.heading,
      markerData: selectedMarker,
    });

    // Update Redux state to trigger Street View panorama change
    console.log('[ThreeJS] 📤 Dispatching setPosition with:', { 
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
      pitch: 0 // Reset pitch to horizon
    }));

    return true;
  };

  // Setup middle-mouse drag navigation and release teleport
  useEffect(() => {
    console.log('[ThreeJS] 🖱️ Setting up middle-mouse drag navigation and release teleport...');

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

      // Calculate vertical movement since drag start
      const deltaY = dragStartYRef.current - event.clientY; // Positive = drag up, Negative = drag down
      accumulatedDragRef.current += deltaY;
      dragStartYRef.current = event.clientY;

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

        // Check if selected marker is NOT the closest (index 0)
        if (selectedMarkerIndexRef.current !== 0) {
          console.log('[ThreeJS] 🖱️ Selected marker is NOT closest - triggering teleport on release:', {
            selectedIndex: selectedMarkerIndexRef.current,
            closestIndex: 0,
          });
          
          // Trigger teleport
          performTeleport('MIDDLE_MOUSE_RELEASE');
        } else {
          console.log('[ThreeJS] 🖱️ Selected marker IS closest - skipping teleport on release:', {
            selectedIndex: selectedMarkerIndexRef.current,
          });
        }

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
  }, [dispatch]); // Added dispatch as dependency

  // Setup Enter key teleport feature
  useEffect(() => {
    console.log('[ThreeJS] ⌨️ Setting up Enter key teleport...');

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Enter key
      if (event.key !== 'Enter') {
        return;
      }

      console.log('[ThreeJS] ⌨️ Enter key detected! Starting teleport...');

      // Trigger teleport
      const success = performTeleport('ENTER_KEY');
      
      if (success) {
        // Prevent default Enter key behavior
        event.preventDefault();
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    console.log('[ThreeJS] ✅ Enter key listener attached to document');

    // Cleanup
    return () => {
      console.log('[ThreeJS] 🧹 Removing Enter key listener');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch]); // Only dispatch as dependency

  // Detect position changes and reset selected marker to closest
  useEffect(() => {
    // Skip if this is the first position (initialization)
    if (!previousPositionRef.current) {
      console.log('[ThreeJS] 📍 First position recorded:', position);
      previousPositionRef.current = position;
      return;
    }

    // Check if position actually changed (teleport occurred)
    const positionChanged = 
      previousPositionRef.current.lat !== position.lat ||
      previousPositionRef.current.lng !== position.lng;

    if (positionChanged) {
      console.log('[ThreeJS] 🔄 POSITION CHANGED - Resetting selected marker to closest:', {
        previousPosition: previousPositionRef.current,
        newPosition: position,
        previousSelectedIndex: selectedMarkerIndex,
      });

      // Reset selected marker to closest (index 0)
      setSelectedMarkerIndex(0);
      console.log('[ThreeJS] ✅ Selected marker reset to index 0 (closest)');

      // Update previous position
      previousPositionRef.current = position;
    }
  }, [position]); // Only depend on position changes

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

    // Extract LatLng coordinates from visible markers
    const visiblePoints = visibilityResult.visibleMarkers.map(marker => 
      interpolatedRoute.points[marker.originalRouteIndex]
    );

    // Store visible markers with heading information for teleport feature
    const markersWithHeading: Array<{ lat: number; lng: number; heading: number }> = [];
    for (let i = 0; i < visiblePoints.length - 1; i++) {
      const currentPoint = visiblePoints[i];
      const nextPoint = visiblePoints[i + 1];
      
      // Calculate heading from current point to next point
      const heading = google.maps.geometry.spherical.computeHeading(
        new google.maps.LatLng(currentPoint.lat, currentPoint.lng),
        new google.maps.LatLng(nextPoint.lat, nextPoint.lng)
      );
      
      markersWithHeading.push({
        lat: currentPoint.lat,
        lng: currentPoint.lng,
        heading: heading,
      });
    }
    
    visibleMarkersRef.current = markersWithHeading;
    
    console.log('[ThreeJS] 📊 Visible markers data:', {
      count: markersWithHeading.length,
      firstMarker: markersWithHeading[0],
      selectedIndex: selectedMarkerIndex,
      selectedMarker: markersWithHeading[selectedMarkerIndex],
      closestMarkerDistance: visibilityResult.visibleMarkers[0]?.distance,
    });

    if (visiblePoints.length < 2) {
      // Clean up existing arrows and their pending timeouts
      if (routeArrowsRef.current.length > 0) {
        console.log('[ThreeJS] 🧹 Cleaning up arrows and cancelling pending animations...');
        routeArrowsRef.current.forEach(arrowState => {
          // Cancel any pending scale animation timeouts
          if (arrowState.scaleTimeoutId !== undefined) {
            clearTimeout(arrowState.scaleTimeoutId);
            console.log('[ThreeJS] ⏸️ Cancelled pending scale animation timeout');
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

    // STAGE 3: 3D CONVERSION
    const polyline3D = polylineTo3D(visiblePoints, position);

    // STAGE 4: ARROW CREATION WITH COLOR, DELAYED ANIMATED SIZE, AND DISTANCE-BASED OPACITY
    // Remove existing arrows if present and cancel their pending timeouts
    if (routeArrowsRef.current.length > 0) {
      console.log('[ThreeJS] 🧹 Route markers regenerated - cancelling all pending scale animations...');
      routeArrowsRef.current.forEach(arrowState => {
        // Cancel any pending scale animation timeouts
        if (arrowState.scaleTimeoutId !== undefined) {
          clearTimeout(arrowState.scaleTimeoutId);
          console.log('[ThreeJS] ⏸️ Cancelled pending scale animation timeout for arrow');
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

    // Create arrow geometry components with increased segments for smoother appearance
    const coneGeometry = new THREE.ConeGeometry(0.3, 0.6, 32, 1);
    const cylinderGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 32, 1);
    
    console.log('[ThreeJS] 🎨 Arrow geometry created with high-quality segments:', {
      coneSegments: 32,
      cylinderSegments: 32,
      improvement: '4x smoother than default (8 segments)',
    });

    // Create arrows at each 3D point (except last - no next position)
    const newArrows: ArrowAnimationState[] = [];
    
    for (let i = 0; i < polyline3D.points.length - 1; i++) {
      const currentPoint = polyline3D.points[i];
      const nextPoint = polyline3D.points[i + 1];
      
      // Determine if this is the selected marker
      const isSelectedMarker = i === selectedMarkerIndex;
      
      // Create SEPARATE materials for each arrow (required for individual opacity control)
      // IMMEDIATE COLOR CHANGE - no delay
      const coneMaterial = new THREE.MeshStandardMaterial({
        color: isSelectedMarker ? 0xff0000 : 0x14b8a6, // Red for selected, teal for default
        transparent: true, // CRITICAL: Enable transparency for opacity to work
        opacity: 0.8, // Initial opacity (will be updated per frame based on distance)
        metalness: 0.3,
        roughness: 0.7,
        depthWrite: false, // Prevent z-fighting issues with transparent objects
      });

      const cylinderMaterial = new THREE.MeshStandardMaterial({
        color: isSelectedMarker ? 0xff0000 : 0x14b8a6, // Red for selected, teal for default
        transparent: true, // CRITICAL: Enable transparency for opacity to work
        opacity: 0.8, // Initial opacity (will be updated per frame based on distance)
        metalness: 0.3,
        roughness: 0.7,
        depthWrite: false, // Prevent z-fighting issues with transparent objects
      });
      
      if (isSelectedMarker) {
        console.log('[ThreeJS] 🔴 Creating RED arrow for selected marker at index (color IMMEDIATE):', i);
      }
      
      // Create arrow group
      const arrowGroup = new THREE.Group();
      
      // Create cone and cylinder with separate materials
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      
      // Position cone at top of cylinder
      cone.position.y = 0.7;
      cylinder.position.y = 0;
      
      arrowGroup.add(cylinder);
      arrowGroup.add(cone);
      
      // Position arrow at current point
      arrowGroup.position.set(currentPoint.x, currentPoint.y, currentPoint.z);
      
      // Set up animation state for this arrow - 2.0x (200%)
      // Start at 1.0x scale for all arrows (no immediate scale change)
      const currentScale = 1.0;
      
      // Apply initial scale (1.0x for all)
      arrowGroup.scale.set(currentScale, currentScale, currentScale);
      
      // Create animation state with material references for opacity updates
      const arrowState: ArrowAnimationState = {
        group: arrowGroup,
        currentScale: currentScale,
        targetScale: 1.0, // Will be updated after delay if selected
        isAnimating: false, // Will be set to true after delay if selected
        coneMaterial: coneMaterial, // Store material reference for opacity updates
        cylinderMaterial: cylinderMaterial, // Store material reference for opacity updates
        scaleTimeoutId: undefined, // Will store timeout ID if scaling is scheduled
      };
      
      // DELAYED SCALING ANIMATION - 0.5s delay before starting
      if (isSelectedMarker) {
        console.log('[ThreeJS] ⏱️ Scheduling scale-up animation with 0.5s delay for selected marker:', {
          index: i,
          currentScale,
          targetScaleAfterDelay: 2.0,
          delay: '500ms',
        });
        
        // Schedule the scale animation to start after 0.5 seconds
        const timeoutId = window.setTimeout(() => {
          console.log('[ThreeJS] 🎬 Starting delayed scale-up animation for selected marker:', {
            index: i,
            currentScale: arrowState.currentScale,
            targetScale: 2.0,
          });
          
          arrowState.targetScale = 2.0;
          arrowState.isAnimating = true;
          arrowState.scaleTimeoutId = undefined; // Clear timeout ID after execution
        }, 500); // 0.5 second delay
        
        arrowState.scaleTimeoutId = timeoutId;
      }
      
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
      newArrows.push(arrowState);
    }

    routeArrowsRef.current = newArrows;
    
    console.log('[ThreeJS] ✅ Arrows created with IMMEDIATE color change and DELAYED scaling animation:', {
      totalCount: newArrows.length,
      selectedIndex: selectedMarkerIndex,
      scheduledAnimations: newArrows.filter(a => a.scaleTimeoutId !== undefined).length,
      selectedMarkerVisuals: {
        color: 'RED (IMMEDIATE - 0ms)',
        targetScale: '2.0x (DELAYED - 500ms)',
        animation: 'SCALE UP (after 0.5s delay)',
        opacity: 'DISTANCE-BASED (5m=70%, 35m+=100%)',
      },
      defaultMarkerVisuals: {
        color: 'TEAL (IMMEDIATE)',
        targetScale: '1.0x (no animation)',
        animation: 'NONE',
        opacity: 'DISTANCE-BASED (5m=70%, 35m+=100%)',
      },
    });

  }, [isStreetViewLoaded, hasRoute, position, pov.heading, routePolyline, selectedMarkerIndex]); // Added selectedMarkerIndex

  // Update arrow animations when selected marker changes
  useEffect(() => {
    if (routeArrowsRef.current.length === 0) {
      return;
    }

    console.log('[ThreeJS] 🎬 Updating arrow animations for selection change:', {
      selectedIndex: selectedMarkerIndex,
      totalArrows: routeArrowsRef.current.length,
    });

    // Update target scales, materials, and schedule animations - 2.0x (200%)
    routeArrowsRef.current.forEach((arrowState, index) => {
      const isSelected = index === selectedMarkerIndex;
      const newColor = isSelected ? 0xff0000 : 0x14b8a6; // Red for selected, teal for default
      
      // IMMEDIATE COLOR CHANGE - no delay
      arrowState.coneMaterial.color.setHex(newColor);
      arrowState.cylinderMaterial.color.setHex(newColor);
      
      console.log('[ThreeJS] 🎨 Arrow color changed IMMEDIATELY:', {
        index,
        isSelected,
        color: isSelected ? 'RED' : 'TEAL',
      });
      
      // Cancel any existing pending scale animation timeout
      if (arrowState.scaleTimeoutId !== undefined) {
        clearTimeout(arrowState.scaleTimeoutId);
        arrowState.scaleTimeoutId = undefined;
        console.log('[ThreeJS] ⏸️ Cancelled previous pending scale animation for arrow:', index);
      }
      
      // DELAYED SCALING ANIMATION
      if (isSelected) {
        // Schedule scale-up animation with 0.5s delay
        console.log('[ThreeJS] ⏱️ Scheduling scale-up animation with 0.5s delay:', {
          index,
          currentScale: arrowState.currentScale,
          targetScaleAfterDelay: 2.0,
        });
        
        const timeoutId = window.setTimeout(() => {
          console.log('[ThreeJS] 🎬 Starting delayed scale-up animation:', {
            index,
            currentScale: arrowState.currentScale,
            targetScale: 2.0,
          });
          
          arrowState.targetScale = 2.0;
          arrowState.isAnimating = true;
          arrowState.scaleTimeoutId = undefined; // Clear timeout ID after execution
        }, 500); // 0.5 second delay
        
        arrowState.scaleTimeoutId = timeoutId;
      } else {
        // Deselected - scale down immediately (no delay for scale-down)
        if (arrowState.targetScale !== 1.0) {
          console.log('[ThreeJS] 🎬 Starting immediate scale-down animation:', {
            index,
            currentScale: arrowState.currentScale,
            targetScale: 1.0,
          });
          
          arrowState.targetScale = 1.0;
          arrowState.isAnimating = true;
        }
      }
    });

  }, [selectedMarkerIndex]);

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
