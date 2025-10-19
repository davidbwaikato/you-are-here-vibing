import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useRoutePolyline } from '@/hooks/useRoutePolyline';
import { truncatePolyline } from '@/utils/geoUtils';
import { polylineTo3D } from '@/utils/coordinateConversion';
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

    console.log('[ThreeJS] 🏹 Creating 3D directional arrows from current position...');
    console.log('[ThreeJS] 📍 Current Street View position:', position);

    // Step 1: Truncate route to 100 meters from current position
    const truncatedRoute = truncatePolyline(routePolyline, 100);
    
    console.log('[ThreeJS] ✂️ Route truncation complete:', {
      originalPoints: routePolyline.length,
      truncatedPoints: truncatedRoute.points.length,
      totalDistance: truncatedRoute.totalDistance.toFixed(2) + 'm',
      wasTruncated: truncatedRoute.truncated,
    });

    if (truncatedRoute.points.length < 2) {
      console.warn('[ThreeJS] ⚠️ Not enough points to create arrows after truncation');
      return;
    }

    // Step 2: Convert truncated LatLng points to 3D coordinates
    const polyline3D = polylineTo3D(truncatedRoute.points, position);
    
    console.log('[ThreeJS] 🔄 3D conversion complete:', {
      points3D: polyline3D.points.length,
      totalLength3D: polyline3D.totalLength.toFixed(2) + 'm',
    });

    // Step 3: Remove existing arrows if present
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

    // Step 4: Create arrow geometry components
    // Arrow consists of a cone (tip) and cylinder (shaft)
    const coneGeometry = new THREE.ConeGeometry(0.3, 0.6, 8); // radius, height, segments
    const cylinderGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8); // radiusTop, radiusBottom, height, segments
    
    // Step 5: Create teal material for arrows
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x14b8a6, // Teal color
      transparent: true,
      opacity: 0.8,
      metalness: 0.3,
      roughness: 0.7,
    });

    // Step 6: Create an arrow at each 3D point (except first and last)
    const newArrows: THREE.Group[] = [];
    
    // Start at index 1 to skip first point (user's current position)
    // End at points.length - 1 to skip last point (no next position)
    for (let i = 1; i < polyline3D.points.length - 1; i++) {
      const currentPoint = polyline3D.points[i];
      const nextPoint = polyline3D.points[i + 1];
      
      // Create arrow group to hold cone and cylinder
      const arrowGroup = new THREE.Group();
      
      // Create cone (arrow tip) and cylinder (arrow shaft)
      const cone = new THREE.Mesh(coneGeometry, arrowMaterial);
      const cylinder = new THREE.Mesh(cylinderGeometry, arrowMaterial);
      
      // Position cone at top of cylinder
      // Cone points up by default, cylinder is vertical
      cone.position.y = 0.7; // 0.4 (half cylinder height) + 0.3 (half cone height)
      cylinder.position.y = 0;
      
      arrowGroup.add(cylinder);
      arrowGroup.add(cone);
      
      // Position arrow at current point
      arrowGroup.position.set(currentPoint.x, currentPoint.y, currentPoint.z);
      
      // Calculate direction vector from current to next point
      const direction = new THREE.Vector3(
        nextPoint.x - currentPoint.x,
        nextPoint.y - currentPoint.y,
        nextPoint.z - currentPoint.z
      );
      direction.normalize();
      
      // Calculate rotation to point arrow in direction of travel
      // Default arrow points up (0, 1, 0), we need to rotate it to point in direction
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, direction);
      arrowGroup.setRotationFromQuaternion(quaternion);
      
      sceneRef.current?.add(arrowGroup);
      newArrows.push(arrowGroup);
      
      if (i === 1) {
        console.log('[ThreeJS] 📍 First arrow (index 1):', {
          position: currentPoint,
          direction: { x: direction.x.toFixed(3), y: direction.y.toFixed(3), z: direction.z.toFixed(3) },
          note: 'Skipped index 0 (user position)',
        });
      } else if (i === polyline3D.points.length - 2) {
        console.log('[ThreeJS] 📍 Last arrow:', {
          position: currentPoint,
          direction: { x: direction.x.toFixed(3), y: direction.y.toFixed(3), z: direction.z.toFixed(3) },
        });
      }
    }

    routeArrowsRef.current = newArrows;
    
    console.log('[ThreeJS] ✅ 3D directional arrows created and added to scene:', {
      color: 'teal (#14b8a6)',
      arrowCount: newArrows.length,
      totalPoints: polyline3D.points.length,
      omittedPoints: 2,
      omittedReason: 'First point (user position) and last point (no next position)',
      dimensions: 'cone: 0.6m height, cylinder: 0.8m height',
      totalArrowHeight: '1.4m',
      totalRouteLength: polyline3D.totalLength.toFixed(2) + 'm',
    });
    console.log('[ThreeJS] 🌍 Arrows are WORLD-SPACE anchored (update on position change)');
    console.log('[ThreeJS] 📏 Showing next 100m of route from current position');
    console.log('[ThreeJS] 🧭 Each arrow points toward the next route point');
    console.log('[ThreeJS] ✨ First arrow omitted to prevent overlap with user position');

  }, [isStreetViewLoaded, hasRoute, position, routePolyline]);

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
