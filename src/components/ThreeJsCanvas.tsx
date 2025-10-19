import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import * as THREE from 'three';

interface ThreeJsCanvasProps {
  isReady: boolean;
}

export const ThreeJsCanvas = ({ isReady }: ThreeJsCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get Street View POV and zoom from Redux store
  const { pov, zoom } = useSelector((state: RootState) => state.streetView);

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

    // Create a 1-meter cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Green
      wireframe: false,
      transparent: true,
      opacity: 0.8,
    });
    const cube = new THREE.Mesh(geometry, material);
    
    // Position cube 8 meters forward at eye level (0m height) in WORLD SPACE
    // Street View treats camera capture height as 0m (origin at eye level)
    // Y-axis is up in Three.js, so Y=0 = eye level
    cube.position.set(0, 0, -8);
    scene.add(cube);
    cubeRef.current = cube;
    console.log('[ThreeJS] ✅ Demo cube created at world-space position (0, 0, -8)');
    console.log('[ThreeJS] 📦 Cube dimensions: 1m x 1m x 1m, positioned at eye level (0m height)');
    console.log('[ThreeJS] 🌍 Cube is WORLD-SPACE anchored (fixed relative to Street View panorama)');
    console.log('[ThreeJS] 👁️ Street View coordinate system: 0m = camera capture height (eye level)');

    // Add some lighting for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    console.log('[ThreeJS] ✅ Lighting added');

    // Animation loop - renders the scene with updated camera rotation
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

      if (cubeRef.current) {
        cubeRef.current.geometry.dispose();
        if (Array.isArray(cubeRef.current.material)) {
          cubeRef.current.material.forEach(m => m.dispose());
        } else {
          cubeRef.current.material.dispose();
        }
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      cubeRef.current = null;
    };
  }, [isReady]);

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
