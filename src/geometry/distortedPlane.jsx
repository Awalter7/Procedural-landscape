import { Component } from "react";
import * as THREE from "three";
import seedrandom from "seedrandom";
import { createNoise3D } from "simplex-noise";
import Plane from "./plane";
import {GPUCompute} from "../utils/compute"

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

const computeDistortion = /* wgsl */ `
struct DistortUniforms {
  amplitude       : f32,
  frequency       : f32,
  offset          : f32,
  distortHeight   : f32,
  exponentiation  : f32,
  lacunarity      : f32,
  octaves         : u32,
  posX            : f32,
  posY            : f32,
  maxHeight       : f32,
  count           : u32,
  _padding        : f32,  // <--- extra float to reach 48 bytes (multiple of 16)
}

@group(0) @binding(0) var<uniform> uniforms : DistortUniforms;

// originalPositions is [x0,y0,z0, x1,y1,z1, ...]
@group(0) @binding(1) var<storage, read> originalPositions : array<f32>;

// outPositions is [x0,y0,z0, x1,y1,z1, ...]
@group(0) @binding(2) var<storage, read_write> outPositions : array<f32>;

fn permute4(x: vec4f) -> vec4f { return ((x * 34. + 1.) * x) % vec4f(289.); }
fn fade2(t: vec2f) -> vec2f { return t * t * t * (t * (t * 6. - 15.) + 10.); }

fn perlinNoise2(P: vec2f) -> f32 {
    var Pi: vec4f = floor(P.xyxy) + vec4f(0., 0., 1., 1.);
    let Pf = fract(P.xyxy) - vec4f(0., 0., 1., 1.);
    Pi = Pi % vec4f(289.); // To avoid truncation effects in permutation
    let ix = Pi.xzxz;
    let iy = Pi.yyww;
    let fx = Pf.xzxz;
    let fy = Pf.yyww;
    let i = permute4(permute4(ix) + iy);
    var gx: vec4f = 2. * fract(i * 0.0243902439) - 1.; // 1/41 = 0.024...
    let gy = abs(gx) - 0.5;
    let tx = floor(gx + 0.5);
    gx = gx - tx;
    var g00: vec2f = vec2f(gx.x, gy.x);
    var g10: vec2f = vec2f(gx.y, gy.y);
    var g01: vec2f = vec2f(gx.z, gy.z);
    var g11: vec2f = vec2f(gx.w, gy.w);
    let norm = 1.79284291400159 - 0.85373472095314 *
        vec4f(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
    g00 = g00 * norm.x;
    g01 = g01 * norm.y;
    g10 = g10 * norm.z;
    g11 = g11 * norm.w;
    let n00 = dot(g00, vec2f(fx.x, fy.x));
    let n10 = dot(g10, vec2f(fx.y, fy.y));
    let n01 = dot(g01, vec2f(fx.z, fy.z));
    let n11 = dot(g11, vec2f(fx.w, fy.w));
    let fade_xy = fade2(Pf.xy);
    let n_x = mix(vec2f(n00, n01), vec2f(n10, n11), vec2f(fade_xy.x));
    let n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return 2.3 * n_xy;
}

fn fractalNoise(point: vec3<f32>) -> f32 {
  var sum = 0.0;
  var amp = uniforms.amplitude;
  var freq = uniforms.frequency;

  for (var i = 0u; i < 6; i++) {
    let samplePoint = point * (freq / uniforms.offset);
    let n = perlinNoise2(vec2<f32>(samplePoint.x + uniforms.posX, samplePoint.z + uniforms.posY));

    let ridge = pow(1.0 - abs(n), 2.0);
    sum = sum + ridge * amp;

    amp  = amp  * 0.2;
    freq = freq * uniforms.lacunarity;
  }
  return pow(sum, uniforms.exponentiation) * uniforms.distortHeight;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let i = global_id.x;
  if (i >= uniforms.count) {
    return;
  }

  let idx = i * 3u;
  let x = originalPositions[idx + 0u];
  let y = originalPositions[idx + 1u];
  let z = originalPositions[idx + 2u];

  let basePoint = vec3<f32>(x, y, z);

  // // Sample noise multiple times, as your CPU code does:
  let noiseA = fractalNoise(basePoint);
  // let pointA = basePoint + vec3<f32>(0.0, noiseA, 0.0);

  // let noiseB = fractalNoise(pointA);
  // let pointB = basePoint + vec3<f32>(0.0, noiseB, 0.0);

  // let noiseC = fractalNoise(pointB);

  var totalNoise = perlinNoise2(vec2<f32>(basePoint.x + uniforms.posX, basePoint.z + uniforms.posY));
  if (totalNoise > uniforms.maxHeight) {
    totalNoise = uniforms.maxHeight;
  }

  outPositions[idx + 0u] = x;
  outPositions[idx + 1u] = y + noiseA;
  outPositions[idx + 2u] = z;
}
`;

const computeUVFunction = /* wgsl */ `
  struct Uniforms {
    bboxMin : vec2<f32>,
    bboxMax : vec2<f32>,
    count   : u32,
    _pad    : u32,    // <--- 4-byte padding
  }

  @group(0) @binding(0) var<uniform> uniforms : Uniforms;

  // positions is an array of floats [x0,y0,z0, ...]
  @group(0) @binding(1) var<storage, read> positions : array<f32>;

  // uvs is an array of floats [u0,v0, u1,v1, ...]
  @group(0) @binding(2) var<storage, read_write> uvs : array<f32>;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let i = global_id.x;
    if (i >= uniforms.count) {
      return;
    }

    let posIndex = i * 3u;
    let x = positions[posIndex];
    let z = positions[posIndex + 2u];

    // Notice we now use uniforms.bboxMin.x, uniforms.bboxMax.x, etc.
    let u = (x - uniforms.bboxMin.x) / (uniforms.bboxMax.x - uniforms.bboxMin.x);
    let v = (z - uniforms.bboxMin.y) / (uniforms.bboxMax.y - uniforms.bboxMin.y);

    let uvIndex = i * 2u;
    uvs[uvIndex]     = u;
    uvs[uvIndex + 1] = v;
  }
`;

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

    this.geomComputeInstance = new GPUCompute();
    this.UVComputeInstance = new GPUCompute();


    this.initGeomCompute();
    this.initUVCompute();
    // this.computeUVs();
  }


  async initGeomCompute(){
    this.geomComputeInstance.code = computeDistortion;
    await this.geomComputeInstance.init(); 

    this.distort();
  }

  async initUVCompute(){
    this.UVComputeInstance.code = computeUVFunction;
    await this.UVComputeInstance.init();

    this.computeUVs();
  }

  get amplitude() {
    return this._amplitude;
  }

  set amplitude(value) {
    this._amplitude = value;
    this.scheduleUpdate();
  }

  get frequency() {
    return this._frequency;
  }

  set frequency(value) {
    this._frequency = value;
    this.scheduleUpdate();
  }

  get offset() {
    return this._offset;
  }

  set offset(value) {
    this._offset = value;
    this.scheduleUpdate();
  }

  get distortHeight() {
    return this._distortHeight;
  }

  set distortHeight(value) {
    this._distortHeight = value;
    this.scheduleUpdate();
  }

  get exponentiation() {
    return this._exponentiation;
  }

  set exponentiation(value) {
    this._exponentiation = value;
    this.scheduleUpdate();
  }

  get lacunarity() {
    return this._lacunarity;
  }

  set lacunarity(value) {
    this._lacunarity = value;
    this.scheduleUpdate();
  }

  get octaves() {
    return this._octaves;
  }

  set octaves(value) {
    this._octaves = value;
    this.scheduleUpdate();
  }

  get posX() {
    return this._posX;
  }

  set posX(value) {
    this._posX = value;
    this.scheduleUpdate();
  }

  get posY() {
    return this._posY;
  }

  set posY(value) {
    this._posY = value;
    this.scheduleUpdate();
  }

  get maxHeight() {
    return this._maxHeight;
  }

  set maxHeight(value) {
    this._maxHeight = value;
    this.scheduleUpdate();
  }

  scheduleUpdate(delay = 10) {
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
    }
    this._updateTimeout = setTimeout(() => {
      this.distort();
      this.computeUVs();
    }, delay);
  }


  async computeUVs() {
    try {
      if (!this.geometry) return;

      this.geometry.computeBoundingBox();
      const bbox = this.geometry.boundingBox;
      const min = bbox.min;
      const max = bbox.max;

      const posArray = this.geometry.attributes.position.array;
      const vertexCount = posArray.length / 3;

      if (vertexCount === 0) {
        console.warn("No vertices — skipping GPU distortion.");
        return;
      }

      const uvArray = new Float32Array(vertexCount * 2);


      const uniformData = new Float32Array([
        min.x,
        min.z,
        max.x,
        max.z,
        vertexCount,
        0, // <--- match _pad in WGSL
      ]);

      const uniformBufferInfo = {
        label: "UVUniforms",
        usage: "uniform",
        data: uniformData,
      };
      const positionsBufferInfo = {
        label: "Positions",
        usage: "storage",
        data: posArray, 
      };
      const uvsBufferInfo = {
        label: "UVs",
        usage: "storage",
        data: uvArray, 
      };


      this.UVComputeInstance.createResources(
        [uniformBufferInfo, positionsBufferInfo, uvsBufferInfo], "UVS"
      );

      const workgroupCount = Math.ceil(vertexCount / 64);

  
      const resultBuffers = await this.UVComputeInstance.runComputePass(workgroupCount);
      const computedUVs = resultBuffers[2].data;

      this.geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(computedUVs, 2)
      );

      this.geometry.attributes.uv.needsUpdate = true;
    } catch (err) {
      console.error("Error computing UVs on GPU:", err);
    }
  }

  // computeUVs() {
  //   this.geometry.computeBoundingBox();

  //   const bbox = this.geometry.boundingBox;

  //   const positions = this.geometry.attributes.position.array;
  //   const uvs = new Float32Array((positions.length / 3) * 2);

  //   let uvIndex = 0;

  //   for (let i = 0; i < positions.length; i += 3) {
  //     const x = positions[i];
  //     const y = positions[i + 1]; // Not used for UV
  //     const z = positions[i + 2];

  //     // Map x from bbox.min.x ... bbox.max.x to [0..1]
  //     const u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);

  //     // Map z from bbox.min.z ... bbox.max.z to [0..1]
  //     const v = (z - bbox.min.z) / (bbox.max.z - bbox.min.z);

  //     uvs[uvIndex++] = u;
  //     uvs[uvIndex++] = v;
  //   }

  //   this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  // }

  async distort() {
    try {
      if (!this.geometry) return;

      const originalPositions = this.geometry.attributes.originalPos.array;
      const vertexCount = originalPositions.length / 3;
      const outPositions = new Float32Array(originalPositions.length);

      
      // computeInstance.code = computeDistortion;
      // await computeInstance.init();

      // -------------- FIXED: We now provide 12 floats (48 bytes) for DistortUniforms --------------
      const uniformData = new Float32Array([
        this._amplitude,
        this._frequency,
        this._offset,
        this._distortHeight,
        this._exponentiation,
        this._lacunarity,
        this._octaves,
        this._posX,
        this._posY,
        this._maxHeight,
        vertexCount,
        0, // <-- The extra padding field
      ]);

      const distortUniformsBufferInfo = {
        label: "DistortUniforms",
        usage: "uniform",
        data: uniformData,
      };
      const origPositionsBufferInfo = {
        label: "OriginalPositions",
        usage: "storage",
        data: originalPositions,
      };
      const outPositionsBufferInfo = {
        label: "OutPositions",
        usage: "storage",
        data: outPositions,
      };

      this.geomComputeInstance.createResources([
        distortUniformsBufferInfo,
        origPositionsBufferInfo,
        outPositionsBufferInfo,
      ], "Distort");

      const workgroupCount = Math.ceil(vertexCount / 64);
      const resultBuffers = await this.geomComputeInstance.runComputePass(workgroupCount);

      const finalPositions = resultBuffers[2].data;
      this.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(finalPositions, 3)
      );
      this.geometry.computeVertexNormals();
      this.geometry.attributes.position.needsUpdate = true;
    } catch (err) {
      console.error("Error computing Distortion on GPU:", err);
    }
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
