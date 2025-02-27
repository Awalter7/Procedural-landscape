import React, { useEffect, useRef, useState } from "react";
import { GUI } from "dat.gui";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import DistortedPlane from "../geometry/distortedPlane";

import { Terrain } from "../shaders/terrain";
import InstanceScattering from "../components/instanceScattering";
// import GrassChunk from "./InstancedGrass";

import { useLoader } from "@react-three/fiber";

import rockBaseCol from "../assets/terrain/textures/Stylized_Cliff_Rock_003_basecolor.png";
import rockNormalCol from "../assets/terrain/textures/Stylized_Cliff_Rock_003_normal.png";
import rockHeightCol from "../assets/terrain/textures/Stylized_Cliff_Rock_002_height.png";
import rockAOCCColor from "../assets/terrain/textures/Stylized_Cliff_Rock_002_ambientOcclusion.jpg";

import stoneBaseCol from "../assets/terrain/textures/ground_with_rocks_02_color_2k.png";
import stoneNormalCol from "../assets/terrain/textures/ground_with_rocks_02_normal_gl_2k.png";
import stoneAOCCCol from "../assets/terrain/textures/ground_with_rocks_02_ambient_occlusion_2k.png";

import groundBaseCol from "../assets/terrain/textures/ground_03_color_4k.png";
import groundNormalCol from "../assets/terrain/textures/ground_03_normal_gl_4k.png";
import groundHeightCol from "../assets/terrain/textures/ground_03_height_4k.png";
import groundAOCCColor from "../assets/terrain/textures/ground_03_ambient_occlusion_4k.png";

import grassBaseCol from "../assets/terrain/textures/grass_03_color_2k.png";
import grassNormalCol from "../assets/terrain/textures/grass_03_normal_gl_2k.png";
import grassHeightCol from "../assets/terrain/textures/grass_03_height_2k.png";
import grassAOCCColor from "../assets/terrain/textures/grass_03_ambient_occlusion_2k.png";

import mossBaseCol from "../assets/terrain/textures/Moss_Color.jpg";

import smallRock from "../Assets/3dModels/small_rock.glb";
import bushFlower from "../Assets/3dModels/bush_flower.glb";
import floorFlower from "../Assets/3dModels/floor_flower.glb";

import grassDistribution from "../Assets/Grass/Textures/distribution.png";
import grassAlpha from "../Assets/Grass/Textures/alpha_mask.png";

import { useGLTF } from "@react-three/drei";

const Rock = () => {
  const gltf = useGLTF(smallRock);

  return {
    geometry: gltf.scene.children[0].geometry,
    material: gltf.scene.children[0].material,
  };
};

const BushFlower = () => {
  const gltf = useGLTF(bushFlower);

  return {
    geometry: gltf.scene.children[0].geometry,
    material: gltf.scene.children[0].material,
  };
};

const FloorFlower = () => {
  const gltf = useGLTF(floorFlower);

  console.log(gltf.scene.children[0].geometry);
  return {
    geometry: gltf.scene.children[0].geometry,
    material: gltf.scene.children[0].material,
  };
};

const Surface = () => {
  const rockDiff = useLoader(THREE.TextureLoader, rockBaseCol);
  const rockNormal = useLoader(THREE.TextureLoader, rockNormalCol);
  const rockHeight = useLoader(THREE.TextureLoader, rockHeightCol);
  const rockAOCC = useLoader(THREE.TextureLoader, rockAOCCColor);

  const stoneDiff = useLoader(THREE.TextureLoader, stoneBaseCol);
  const stoneNormal = useLoader(THREE.TextureLoader, stoneNormalCol);
  const stoneAOCC = useLoader(THREE.TextureLoader, stoneAOCCCol);

  const groundDiff = useLoader(THREE.TextureLoader, groundBaseCol);
  const groundNormal = useLoader(THREE.TextureLoader, groundNormalCol);
  const groundHeight = useLoader(THREE.TextureLoader, groundHeightCol);
  const groundAOCC = useLoader(THREE.TextureLoader, groundAOCCColor);

  const grassDiff = useLoader(THREE.TextureLoader, grassBaseCol);
  const grassNormal = useLoader(THREE.TextureLoader, grassNormalCol);
  const grassHeight = useLoader(THREE.TextureLoader, grassHeightCol);
  const grassAOCC = useLoader(THREE.TextureLoader, grassAOCCColor);

  const mossDiff = useLoader(THREE.TextureLoader, mossBaseCol);

  const grassDistributionMap = useLoader(
    THREE.TextureLoader,
    grassDistribution
  );
  const grassAlphaMask = useLoader(THREE.TextureLoader, grassAlpha);

  const materialRef = useRef(
    new Terrain({
      rockDiff: rockDiff,
      rockNormal: rockNormal,
      rockHeight: rockHeight,
      rockAOCC: rockAOCC,

      stoneDiff: stoneDiff,
      stoneNormal: stoneNormal,
      stoneAOCC: stoneAOCC,

      groundDiff: groundDiff,
      groundNormal: groundNormal,
      groundHeight: groundHeight,
      groundAOCC: groundAOCC,

      grassDiff: grassDiff,
      grassNormal: grassNormal,
      grassHeight: grassHeight,
      grassAOCC: grassAOCC,

      mossDiff: mossDiff,
    })
  );

  const bushFlower = BushFlower();
  const floorFlower = FloorFlower();
  const rock = Rock();

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
      terrainFolder.add(geomRef.current, "posX", 0, 100);
      terrainFolder.add(geomRef.current, "posY", 0, 100);
      terrainFolder.add(geomRef.current, "maxHeight", 0, 100);

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
          height={1000}
          width={1000}
        />
        {/* <meshPhysicalMaterial map={rockNormal}/> */}
      </mesh>
      <InstanceScattering
        args={[1000, 5, 1000]}
        position={[0, 2.5, 0]}
        max={50}
        mesh={meshRef}
        scale={[2, 2, 2]}
        instanceMaterial={bushFlower.material}
      >
        <primitive object={bushFlower.geometry} />
      </InstanceScattering>
      <InstanceScattering
        args={[1000, 5, 1000]}
        position={[0, 2.5, 0]}
        max={100}
        mesh={meshRef}
        offsetY={0.1}
        scale={[5, 5, 5]}
        instanceMaterial={floorFlower.material}
      >
        <primitive object={floorFlower.geometry} />
      </InstanceScattering>
      <InstanceScattering
        args={[1000, 10, 1000]}
        position={[0, 10, 0]}
        numInstances={10}
        mesh={meshRef}
        randomScale
        randomRotation
        instanceMaterial={rock.material}
      >
        <primitive object={rock.geometry} />
      </InstanceScattering>

      {/* <GrassChunk  
        ref={grassRef}
        mesh={meshRef}

        area={[1000, 5, 1000]}  
        position={[0, 2.5, 0]} 
        
        wireframe 
        
        width={.50}
        height={2.0}
        joints={12}
        offsetY={.15}

        distributionMap={grassDistributionMap}

        max={50000}
        density={100}
      /> */}
    </>
  );
};

export default Surface;
