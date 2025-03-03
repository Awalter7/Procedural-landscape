import React, { useEffect, useRef, useState } from "react";
import { GUI } from "dat.gui";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import DistortedPlane from "../geometry/distortedPlane";

import { Terrain } from "../shaders/terrain";

import { useLoader } from "@react-three/fiber";

import {
  rockColor, 
  rockNormal,
  rockHeight,
  rockAOCC,

  stoneColor,
  stoneNormal,
  stoneHeight,
  stoneAOCC,

  groundColor,
  groundNormal,
  groundHeight,
  groundAOCC,

  grassColor,
  grassNormal,
  grassHeight,
  grassAOCC,

  mossColor,
} from "../assets/terrain/textures/index"


import { useGLTF } from "@react-three/drei";

const Surface = () => {
  const rockDi = useLoader(THREE.TextureLoader, rockColor);
  const rockNo = useLoader(THREE.TextureLoader, rockNormal);
  const rockHe = useLoader(THREE.TextureLoader, rockHeight);
  const rockAO = useLoader(THREE.TextureLoader, rockAOCC);

  const stoneDi = useLoader(THREE.TextureLoader, stoneColor);
  const stoneNo = useLoader(THREE.TextureLoader, stoneNormal);
  const stoneAO = useLoader(THREE.TextureLoader, stoneAOCC);

  const groundDi = useLoader(THREE.TextureLoader, groundColor);
  const groundNo = useLoader(THREE.TextureLoader, groundNormal);
  const groundHe = useLoader(THREE.TextureLoader, groundHeight);
  const groundAO = useLoader(THREE.TextureLoader, groundAOCC);

  const grassDi = useLoader(THREE.TextureLoader, grassColor);
  const grassNo = useLoader(THREE.TextureLoader, grassNormal);
  const grassHe = useLoader(THREE.TextureLoader, grassHeight);
  const grassAO = useLoader(THREE.TextureLoader, grassAOCC);

  const mossDi = useLoader(THREE.TextureLoader, mossColor);

  const materialRef = useRef(
    new Terrain({
      rockDiff: rockDi,
      rockNormal: rockNo,
      rockHeight: rockHe,
      rockAOCC: rockAO,

      stoneDiff: stoneDi,
      stoneNormal: stoneNo,
      stoneAOCC: stoneAO,

      groundDiff: groundDi,
      groundNormal: groundNo,
      groundHeight: groundHe,
      groundAOCC: groundAO,

      grassDiff: grassDi,
      grassNormal: grassNo,
      grassHeight: grassHe,
      grassAOCC: grassAO,

      mossDiff: mossDi,
    })
  );


  const meshRef = useRef();

  const geomRef = useRef();
  const guiRef = useRef();

  const grassRef = useRef();

  useEffect(() => {
    if (geomRef.current && !guiRef.current) {
      const gui = new GUI();
      const terrainFolder = gui.addFolder("terrain");

      terrainFolder.add(geomRef.current, "amplitude", 0, 10);
      terrainFolder.add(geomRef.current, "frequency", 0, 1);
      terrainFolder.add(geomRef.current, "offset", 0, 100);
      terrainFolder.add(geomRef.current, "height", 0, 10);
      terrainFolder.add(geomRef.current, "exponentiation", 1, 3);
      terrainFolder.add(geomRef.current, "lacunarity", 0, 10);
      terrainFolder.add(geomRef.current, "octaves", 0, 100);
      terrainFolder.add(geomRef.current, "posX", 0, 10);
      terrainFolder.add(geomRef.current, "posY", 0, 10);
      terrainFolder.add(geomRef.current, "maxHeight", 0, 100);
      terrainFolder.add(materialRef.current, "scale", 0, 2);

      console.log(materialRef.current)

      terrainFolder.open();
      guiRef.current = gui;
    }
  }, [geomRef]);

  useFrame((state, delta) => {
    if (grassRef.current) {
      grassRef.current.time = grassRef.current.time + delta;
    }
  });

  return (
    <>
      <mesh
        position={[0, 0, 1]}
        material={materialRef.current}
        ref={meshRef}
        castShadow
        receiveShadow
      >
        <DistortedPlane
          ref={geomRef}
          resolution={400}
          height={400}
          width={400}
        />
      </mesh>
    </>
  );
};

export default Surface;
