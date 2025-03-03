import { Component } from "react";
import * as THREE from "three";
import seedrandom from "seedrandom";
import { createNoise3D } from "simplex-noise";
import Plane from "./plane";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

export default class DistortedPlane extends Component {
  constructor(props) {
    super(props);

    this.resolution = props.resolution;
    this.height = props.height;
    this.width = props.width;

    this._amplitude = 1.4;
    this._frequency = 0.11;
    this._offset = 100;
    this._distortHeight = 10.0;
    this._exponentiation = 2.6;
    this._lacunarity = 3.4;
    this._octaves = 10;
    this._posX = 34;
    this._posY = 18;
    this._maxDist = 100;
    this._minDist = 50;
    this._maxHeight = 1000;

    const seededRandom = seedrandom("fixed-seed");
    this.noise = createNoise3D(seededRandom);

    this.geometry = new Plane({
      resolution: this.resolution,
      height: this.height,
      width: this.width,
    }).geometry;

    this.distort();
    this.computeUVs();
  }

  get amplitude() {
    return this._amplitude;
  }

  set amplitude(value) {
    this._amplitude = value;
    this.distort();
    this.computeUVs();
  }

  get frequency() {
    return this._frequency;
  }

  set frequency(value) {
    this._frequency = value;
    this.distort();
    this.computeUVs();
  }

  get offset() {
    return this._offset;
  }

  set offset(value) {
    this._offset = value;
    this.distort();
    this.computeUVs();
  }

  get distortHeight() {
    return this._distortHeight;
  }

  set distortHeight(value) {
    this._distortHeight = value;
    this.distort();
    this.computeUVs();
  }

  get exponentiation() {
    return this._exponentiation;
  }

  set exponentiation(value) {
    this._exponentiation = value;
    this.distort();
    this.computeUVs();
  }

  get lacunarity() {
    return this._lacunarity;
  }

  set lacunarity(value) {
    this._lacunarity = value;
    this.distort();
    this.computeUVs();
  }

  get octaves() {
    return this._octaves;
  }

  set octaves(value) {
    this._octaves = value;
    this.distort();
    this.computeUVs();
  }

  get posX() {
    return this._posX;
  }

  set posX(value) {
    this._posX = value;
    this.distort();
    this.computeUVs();
  }

  get posY() {
    return this._posY;
  }

  set posY(value) {
    this._posY = value;
    this.distort();
    this.computeUVs();
  }

  get maxHeight() {
    return this._maxHeight;
  }

  set maxHeight(value) {
    this._maxHeight = value;
    this.distort();
    this.computeUVs();
  }

  fractalNoise(point) {
    let noiseSum = 0.0;

    let amplitude = this._amplitude;
    let frequency = this._frequency;

    for (let i = 0; i < this._octaves; i++) {
      // Clone the point so we don't mutate the original vector.
      const samplePoint = point
        .clone()
        .multiplyScalar(frequency / this._offset);

      const n = this.noise(
        samplePoint.x + this._posX,
        samplePoint.y + this._posY,
        samplePoint.z
      );

      const ridge = Math.pow(1.0 - Math.abs(n), 2);
      noiseSum += ridge * amplitude;

      amplitude *= 0.2;
      frequency *= this._lacunarity;
    }

    return Math.pow(noiseSum, this._exponentiation) * this._distortHeight;
  }

  distorted(point) {
    // Compute noise in several layers to simulate fractal noise
    const noiseA = this.fractalNoise(point.clone());
    const pointA = point.clone();

    pointA.y += noiseA;

    const noiseB = this.fractalNoise(pointA.clone());
    const pointB = point.clone();

    pointB.y += noiseB;

    const noiseC = this.fractalNoise(pointB.clone());

    // Instead of multiplying the entire vector (which leaves y at 0),
    // we add the noise values to the Y coordinate.

    const distortedPoint = point.clone();

    if (noiseA + noiseB + noiseC <= this._maxHeight) {
      distortedPoint.y += noiseA + noiseB + noiseC;
    } else {
      distortedPoint.y += this._maxHeight;
    }

    return distortedPoint;
  }

  computeUVs() {
    this.geometry.computeBoundingBox();

    const bbox = this.geometry.boundingBox;
    // e.g. bbox.min.x, bbox.min.y, bbox.min.z
    //      bbox.max.x, bbox.max.y, bbox.max.z

    const positions = this.geometry.attributes.position.array;
    const uvs = new Float32Array((positions.length / 3) * 2);

    let uvIndex = 0;

    // Identify which two axes should define (u, v).
    // If your plane is oriented in XZ, you’ll use x, z
    // If in XY, you’ll use x, y
    // etc.
    // for (let i = 0; i < positions.length; i += 3) {
    //   const x = positions[i];
    //   const y = positions[i + 1];
    //   const z = positions[i + 2];

    //   // Example: If your plane is in the XY plane:
    //   const u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);
    //   const v = (y - bbox.min.y) / (bbox.max.y - bbox.min.y);

    //   uvs[uvIndex++] = u;
    //   uvs[uvIndex++] = v;
    // }
    // let uvIndex = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1]; // Not used for UV
      const z = positions[i + 2];

      // Map x from bbox.min.x ... bbox.max.x to [0..1]
      const u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);

      // Map z from bbox.min.z ... bbox.max.z to [0..1]
      const v = (z - bbox.min.z) / (bbox.max.z - bbox.min.z);

      uvs[uvIndex++] = u;
      uvs[uvIndex++] = v;
    }

    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }

  distort() {
    if (!this.geometry) return;

    const positions = this.geometry.attributes.originalPos.array;

    const dPositions = [];

    for (let i = 0; i < positions.length; i += 3) {
      const point = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );
      const dPoint = this.distorted(point);
      dPositions[i] = dPoint.x;
      dPositions[i + 1] = dPoint.y;
      dPositions[i + 2] = dPoint.z;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(dPositions, 3)
    );

    this.geometry.computeVertexNormals();
    this.geometry.attributes.position.needsUpdate = true;
  }

  computeCreases(geometry, angleThresholdDeg = 20) {
    // -------------------------------------------
    // 1) Ensure geometry is indexed & has normals
    // -------------------------------------------
    geometry.computeVertexNormals();

    if (!geometry.index) {
      console.warn("Geometry is not indexed. Attempting to convert...");
      geometry = geometry.toNonIndexed();
      // Alternatively: geometry = BufferGeometryUtils.mergeVertices( geometry );
    }

    const indexArray = geometry.index.array;
    const posArray = geometry.attributes.position.array; // (x,y,z) per vertex
    // We'll compute face normals ourselves, though geometry already has vertex normals:
    const faceNormals = [];

    // -------------------------------------------
    // 2) Compute Face Normals for Each Triangle
    // -------------------------------------------
    const tempVecA = new THREE.Vector3();
    const tempVecB = new THREE.Vector3();
    const tempVecC = new THREE.Vector3();

    for (let f = 0; f < indexArray.length; f += 3) {
      const iA = indexArray[f + 0];
      const iB = indexArray[f + 1];
      const iC = indexArray[f + 2];

      tempVecA.fromArray(posArray, iA * 3);
      tempVecB.fromArray(posArray, iB * 3);
      tempVecC.fromArray(posArray, iC * 3);

      // (B - A) x (C - A)
      const edge1 = new THREE.Vector3().subVectors(tempVecB, tempVecA);
      const edge2 = new THREE.Vector3().subVectors(tempVecC, tempVecA);

      const faceNormal = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize();

      faceNormals.push(faceNormal);
    }

    // -------------------------------------------
    // 3) Build adjacency from vertex -> faces
    //    so we know which faces each vertex is part of
    // -------------------------------------------
    const vertToFaceMap = new Map(); // key: vertexIndex, value: array of face indices
    for (let faceIndex = 0; faceIndex < faceNormals.length; faceIndex++) {
      const base = faceIndex * 3;
      const iA = indexArray[base + 0];
      const iB = indexArray[base + 1];
      const iC = indexArray[base + 2];

      [iA, iB, iC].forEach((vId) => {
        if (!vertToFaceMap.has(vId)) {
          vertToFaceMap.set(vId, []);
        }
        vertToFaceMap.get(vId).push(faceIndex);
      });
    }

    // -------------------------------------------
    // 4) Determine which vertices are "on a crease"
    //    by checking the maximum angle among faces
    // -------------------------------------------
    const vertexCount = posArray.length / 3;
    const creaseFlags = new Uint8Array(vertexCount); // 0 or 1

    for (let vId = 0; vId < vertexCount; vId++) {
      const faces = vertToFaceMap.get(vId);
      if (!faces || faces.length < 2) {
        // If only one face references this vertex, no angle difference
        creaseFlags[vId] = 0;
        continue;
      }

      let maxAngle = 0;
      // Compare each face normal to every other face normal
      for (let i = 0; i < faces.length; i++) {
        for (let j = i + 1; j < faces.length; j++) {
          const fnA = faceNormals[faces[i]];
          const fnB = faceNormals[faces[j]];
          const dot = fnA.dot(fnB);
          const angle = Math.acos(Math.min(Math.max(dot, -1.0), 1.0));
          if (angle > maxAngle) {
            maxAngle = angle;
          }
        }
      }

      // Convert to degrees
      const maxAngleDeg = THREE.MathUtils.radToDeg(maxAngle);

      // If above threshold, mark as "on a crease"
      creaseFlags[vId] = maxAngleDeg >= angleThresholdDeg ? 1 : 0;
    }

    // -------------------------------------------
    // 5) Build adjacency from vertex -> vertex
    //    so we can run Dijkstra (or BFS)
    // -------------------------------------------
    // We'll store for each vertex: an array of { neighborId, edgeLength }.
    const vertexNeighbors = new Array(vertexCount);
    for (let v = 0; v < vertexCount; v++) {
      vertexNeighbors[v] = [];
    }

    // Each face has (iA, iB, iC) => each pair is adjacent
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();

    for (let f = 0; f < indexArray.length; f += 3) {
      const iA = indexArray[f + 0];
      const iB = indexArray[f + 1];
      const iC = indexArray[f + 2];

      // Add adjacency for edges (iA,iB), (iB,iC), (iC,iA)
      const indices = [iA, iB, iC];
      for (let e = 0; e < 3; e++) {
        const v1 = indices[e];
        const v2 = indices[(e + 1) % 3];

        if (v1 === v2) continue;

        pA.fromArray(posArray, v1 * 3);
        pB.fromArray(posArray, v2 * 3);
        const dist = pA.distanceTo(pB);

        // Add neighbor info (undirected)
        vertexNeighbors[v1].push({ id: v2, length: dist });
        vertexNeighbors[v2].push({ id: v1, length: dist });
      }
    }

    // -------------------------------------------
    // 6) Dijkstra’s Algorithm to find dist to nearest crease
    // -------------------------------------------
    const distToCrease = new Float32Array(vertexCount);
    distToCrease.fill(Infinity);

    // We use a priority queue (min-heap).
    // If you don't have a built-in, we can do a tiny custom or use an array .sort() hack.
    // For brevity, let's do a minimal "array as priority queue" approach.
    const queue = [];

    // Initialize distances: any vertex "on a crease" => distance=0, push to queue
    for (let v = 0; v < vertexCount; v++) {
      if (creaseFlags[v] === 1) {
        distToCrease[v] = 0;
        queue.push(v);
      }
    }

    // A simple function to pop the vertex from queue with smallest dist
    function popMinDist() {
      let minIdx = 0;
      let minVal = distToCrease[queue[0]];
      for (let i = 1; i < queue.length; i++) {
        const vId = queue[i];
        if (distToCrease[vId] < minVal) {
          minIdx = i;
          minVal = distToCrease[vId];
        }
      }
      return queue.splice(minIdx, 1)[0];
    }

    // Dijkstra
    const visited = new Uint8Array(vertexCount); // mark visited

    while (queue.length > 0) {
      // pop vertex with smallest distance
      const current = popMinDist();
      if (visited[current]) continue;
      visited[current] = 1;

      const currDist = distToCrease[current];
      const neighbors = vertexNeighbors[current];

      for (let i = 0; i < neighbors.length; i++) {
        const { id: neighId, length } = neighbors[i];
        if (visited[neighId]) continue;

        const possibleDist = currDist + length;
        if (possibleDist < distToCrease[neighId]) {
          distToCrease[neighId] = possibleDist;
          queue.push(neighId);
        }
      }
    }

    // -------------------------------------------
    // 7) Store distToCrease as an attribute
    // -------------------------------------------
    geometry.setAttribute(
      "distToCrease",
      new THREE.BufferAttribute(distToCrease, 1)
    );
  }

  render() {
    return <primitive object={this.geometry} />;
  }
}
