import { Component, createRef } from "react";
import * as THREE from "three";
import seedrandom from "seedrandom"; // added seedrandom for deterministic randomness

export class InstanceScattering extends Component {
  constructor(props) {
    super(props);

    this.rotation = props.rotation || [0, 0, 0];
    this.position = props.position;

    this.scale = props.scale || [1, 1, 1];
    this.scaleMax = props.scaleMax || 3;
    this.scaleMin = props.scaleMin || 1;
    this.rotation = props.rotation || [0, 0, 0];
    this.rotationMax = props.rotationMax || 100;
    this.rotationMin = props.rotationMin || 0;
    this.randomScale = props.randomScale || false;
    this.randomRotation = props.randomRotation || false;
    this.args = props.args || [1, 1, 1];

    this.offsetX = props.offsetX || 0;
    this.offsetY = props.offsetY || 0;
    this.offsetZ = props.offsetZ || 0;

    this.children = props.children;
    this.wireframe = props.wireframe || false;

    this.instanceGeometry = props.instanceGeometry;
    this.instanceMaterial = props.instanceMaterial;

    this.min = props.min || 0;
    this.max = props.max || 100;
    this.density = props.density || 100; // percent value

    this.seed = props.seed || "defaultseed";

    // Compute instanceCount based on density
    this.instanceCount = Math.floor(
      this.min + (this.max - this.min) * (this.density / 100)
    );

    this.scatterBox = createRef();
    this.instanceMesh = createRef();
    this.mesh = props.mesh;

    this.distributionMap = props.distributionMap;
    this.attributes = props.attributes;
  }

  componentDidMount() {
    this.initialize();
  }

  initialize() {
    const scatterBox = this.scatterBox.current;
    const targetMesh = this.mesh?.current;

    if (!targetMesh || !targetMesh.isMesh || !targetMesh.geometry) {
      console.warn("Provided Mesh Reference is not a valid Mesh.");
      return;
    }

    targetMesh.updateMatrixWorld(true);
    if (!targetMesh.geometry.boundingBox) {
      targetMesh.geometry.computeBoundingBox();
    }
    scatterBox.updateMatrixWorld(true);

    const halfX = this.args[0] / 2;
    const halfY = (this.args[1] || this.args[0]) / 2;
    const halfZ = (this.args[2] || this.args[0]) / 2;

    // Ensure normals exist
    if (!targetMesh.geometry.attributes.normal) {
      targetMesh.geometry.computeVertexNormals();
    }

    // Create a seeded random function
    const combinedSeed = `${this.seed}_${this.density}_${this.min}_${this.max}`;
    const rng = seedrandom(combinedSeed);

    // Get the scatter box’s world bounding box
    const scatterBoxWorld = new THREE.Box3().setFromObject(scatterBox);

    // If a distribution map is provided, create a canvas to extract its pixel data.
    let distributionData = null;
    if (this.distributionMap) {
      const texture = this.distributionMap;
      const image = texture.image;
      if (image) {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.width, image.height);
        distributionData = ctx.getImageData(0, 0, image.width, image.height);
      }
    }

    // Custom function to calculate triangle area using cross product.
    function triangleArea(a, b, c) {
      const ab = new THREE.Vector3().subVectors(b, a);
      const ac = new THREE.Vector3().subVectors(c, a);
      return 0.5 * ab.cross(ac).length();
    }

    const geometry = targetMesh.geometry;
    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    const matrixWorld = targetMesh.matrixWorld;

    const relevantFaces = [];
    const faceAreas = [];
    let totalArea = 0;

    const tempBox = new THREE.Box3();
    const vA = new THREE.Vector3(),
      vB = new THREE.Vector3(),
      vC = new THREE.Vector3();
    const faceCount = indices ? indices.length / 3 : positions.length / 9;

    for (let i = 0; i < faceCount; i++) {
      if (indices) {
        const a = indices[i * 3] * 3;
        const b = indices[i * 3 + 1] * 3;
        const c = indices[i * 3 + 2] * 3;
        vA.set(positions[a], positions[a + 1], positions[a + 2]).applyMatrix4(
          matrixWorld
        );
        vB.set(positions[b], positions[b + 1], positions[b + 2]).applyMatrix4(
          matrixWorld
        );
        vC.set(positions[c], positions[c + 1], positions[c + 2]).applyMatrix4(
          matrixWorld
        );
      } else {
        const a = i * 9;
        vA.set(positions[a], positions[a + 1], positions[a + 2]).applyMatrix4(
          matrixWorld
        );
        vB.set(
          positions[a + 3],
          positions[a + 4],
          positions[a + 5]
        ).applyMatrix4(matrixWorld);
        vC.set(
          positions[a + 6],
          positions[a + 7],
          positions[a + 8]
        ).applyMatrix4(matrixWorld);
      }
      tempBox.setFromPoints([vA, vB, vC]);
      if (tempBox.intersectsBox(scatterBoxWorld)) {
        const area = triangleArea(vA, vB, vC);
        if (area > 0) {
          relevantFaces.push(i);
          faceAreas.push(area);
          totalArea += area;
        }
      }
    }

    if (relevantFaces.length === 0) {
      console.warn("No mesh faces intersect the scatter box.");
      return;
    }

    // Function to sample a face index weighted by its area.
    function sampleFaceIndex() {
      const r = rng() * totalArea;
      let accum = 0;
      for (let i = 0; i < relevantFaces.length; i++) {
        accum += faceAreas[i];
        if (r <= accum) {
          return relevantFaces[i];
        }
      }
      return relevantFaces[relevantFaces.length - 1];
    }

    // Prepare for point sampling.
    const dummy = new THREE.Object3D();
    const matrices = [];
    const samplePos = new THREE.Vector3();
    const localSamplePos = new THREE.Vector3();
    const inverseMatrix = new THREE.Matrix4()
      .copy(scatterBox.matrixWorld)
      .invert();

    // Loop until we've collected the desired instanceCount.
    for (let count = 0; matrices.length < this.instanceCount; count++) {
      const faceIndex = sampleFaceIndex();
      if (indices) {
        const a = indices[faceIndex * 3] * 3;
        const b = indices[faceIndex * 3 + 1] * 3;
        const c = indices[faceIndex * 3 + 2] * 3;
        vA.set(positions[a], positions[a + 1], positions[a + 2]).applyMatrix4(
          matrixWorld
        );
        vB.set(positions[b], positions[b + 1], positions[b + 2]).applyMatrix4(
          matrixWorld
        );
        vC.set(positions[c], positions[c + 1], positions[c + 2]).applyMatrix4(
          matrixWorld
        );
      } else {
        const a = faceIndex * 9;
        vA.set(positions[a], positions[a + 1], positions[a + 2]).applyMatrix4(
          matrixWorld
        );
        vB.set(
          positions[a + 3],
          positions[a + 4],
          positions[a + 5]
        ).applyMatrix4(matrixWorld);
        vC.set(
          positions[a + 6],
          positions[a + 7],
          positions[a + 8]
        ).applyMatrix4(matrixWorld);
      }

      // Generate random barycentric coordinates for a point on the triangle.
      let u = rng(),
        v = rng();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const w = 1 - u - v;
      samplePos
        .set(0, 0, 0)
        .addScaledVector(vA, u)
        .addScaledVector(vB, v)
        .addScaledVector(vC, w);

      // Convert to scatterBox local space.
      localSamplePos.copy(samplePos).applyMatrix4(inverseMatrix);

      // Ensure the point is within the scatter box.
      if (
        localSamplePos.x >= -halfX &&
        localSamplePos.x <= halfX &&
        localSamplePos.y >= -halfY &&
        localSamplePos.y <= halfY &&
        localSamplePos.z >= -halfZ &&
        localSamplePos.z <= halfZ
      ) {
        // If a distribution map exists, sample its brightness.
        if (distributionData) {
          // Map local coordinates to UV space.
          // Here we use the x and z coordinates (assuming distribution map is applied to the XZ plane).
          const uCoord = (localSamplePos.x + halfX) / (2 * halfX);
          const vCoord = (localSamplePos.z + halfZ) / (2 * halfZ);
          // Clamp coordinates to [0, 1]
          const clampedU = Math.min(1, Math.max(0, uCoord));
          const clampedV = Math.min(1, Math.max(0, vCoord));
          const imgX = Math.floor(clampedU * (distributionData.width - 1));
          // Flip v coordinate because image origin is top-left.
          const imgY = Math.floor(
            (1 - clampedV) * (distributionData.height - 1)
          );
          const index = (imgY * distributionData.width + imgX) * 4;
          // Assuming a grayscale image, use the red channel as brightness.
          const brightness = distributionData.data[index];
          // Reject this sample based on brightness.
          if (rng() > brightness / 255) {
            continue;
          }
        }
        // Apply offset, rotation, and scale.
        dummy.position
          .copy(samplePos)
          .add(new THREE.Vector3(this.offsetX, this.offsetY, this.offsetZ));
        dummy.rotation.set(
          this.rotation[0],
          this.rotation[1],
          this.rotation[2]
        );

        if (this.randomScale) {
          const scale =
            Math.random() * (this.scaleMax - this.scaleMin) + this.scaleMin;
          dummy.scale.set(scale, scale, scale);
        } else {
          dummy.scale.set(this.scale[0], this.scale[1], this.scale[2]);
        }

        if (this.randomRotation) {
          const rotation =
            Math.random() * (this.rotationMax - this.rotationMin) +
            this.rotationMin;
          dummy.rotation.set(rotation, rotation, rotation);
        } else {
          dummy.rotation.set(
            this.rotation[0],
            this.rotation[1],
            this.rotation[2]
          );
        }

        dummy.castShadow = true;
        dummy.frustumCulled = false;
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
      }
    }

    if (matrices.length === 0) {
      console.warn("No valid points sampled within the scatter box.");
    }

    // Write the matrices to the instancedMesh.
    if (this.instanceMesh.current) {
      const iMesh = this.instanceMesh.current;
      iMesh.frustumCulled = false;
      iMesh.count = matrices.length;
      matrices.forEach((matrix, i) => iMesh.setMatrixAt(i, matrix));
      iMesh.instanceMatrix.needsUpdate = true;
      if (this.attributes) {
        this.attributes.forEach((attr) => {
          iMesh.geometry.setAttribute(
            attr.name,
            new THREE.InstancedBufferAttribute(attr.array, attr.parse)
          );
        });
      }
    }
  }

  render() {
    return (
      <>
        <mesh ref={this.scatterBox} position={this.position}>
          <boxGeometry args={this.args} />
          <meshBasicMaterial
            wireframe={this.wireframe}
            visible={!this.wireframe && false}
          />
        </mesh>

        <instancedMesh
          ref={this.instanceMesh}
          userData={{ samplerExclude: true }}
          // Updated: use the computed instanceCount instead of numInstances.
          args={[
            this.instanceGeometry || undefined,
            this.instanceMaterial || undefined,
            this.instanceCount,
          ]}
          castShadow
        >
          {this.children ? (
            this.children
          ) : (
            <>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshBasicMaterial color="red" />
            </>
          )}
        </instancedMesh>
      </>
    );
  }
}

export default InstanceScattering;
