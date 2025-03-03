import "./styles.css";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, useScroll } from "@react-three/drei";
import Surface from "./components/terrain";

export default function App() {
  return (
    <Canvas
      shadows
      camera={{ fov: 90, position: [-150, 100, -200], near: 0.1, far: 10000 }}
      gl={{
        antialias: true,
      }}
      style={{ width: "100vw", height: "100vh", backgroundColor: "black" }}
    >
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[1000, 1000, 0]}
        intensity={3.0}
        castShadow
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Surface position={[0, 0, 0]} />
      <OrbitControls makeDefault dampingFactor={0.01} />
    </Canvas>
  );
}
