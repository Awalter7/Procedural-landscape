import * as THREE from "three";

export default class Plane {
  constructor({ resolution, width, height }) {
    this.resolution = resolution;
    this.width = width;
    this.height = height;
    this.geometry = new THREE.BufferGeometry();

    this.constructGeometry(this.resolution, this.width, this.height);
  }

  constructGeometry(resolution, width, height) {
    const positions = new Float32Array(resolution * resolution * 3);
    const indices = new Uint32Array((resolution - 1) * (resolution - 1) * 6);

    let triIndex = 0;
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const i = x + y * resolution;
        const percent = new THREE.Vector2(x, y).divideScalar(resolution - 1);

        const position = new THREE.Vector3(
          percent.x * width - width / 2,
          0,
          percent.y * height - height / 2
        );

        // const distortedPosition = this.distorted(position)

        // console.log("here")

        const vertIndex = i * 3;
        positions[vertIndex + 0] = -position.x;
        positions[vertIndex + 1] = position.y;
        positions[vertIndex + 2] = position.z;

        if (x < resolution - 1 && y < resolution - 1) {
          indices[triIndex + 0] = i;
          indices[triIndex + 1] = i + resolution + 1;
          indices[triIndex + 2] = i + resolution;
          indices[triIndex + 3] = i;
          indices[triIndex + 4] = i + 1;
          indices[triIndex + 5] = i + resolution + 1;
          triIndex += 6;
        }
      }
    }

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    );
    this.geometry.setAttribute(
      "originalPos",
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    );
    this.geometry.setIndex(
      new THREE.BufferAttribute(new Uint32Array(indices), 1)
    );
    this.geometry.computeVertexNormals();
  }
}
