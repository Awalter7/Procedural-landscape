import "./styles.css";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";

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
      <Surface position={[0, 0, 0]} />
    </Canvas>
  );
}
