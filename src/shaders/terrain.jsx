import * as THREE from "three";

export class Terrain extends THREE.MeshPhysicalMaterial {
  constructor(props) {
    super(props);

    this.shader = null;
    this._scale = 1;

    this.rockDiff = props.rockDiff;
    this.rockNormal = props.rockNormal;
    this.rockHeight = props.rockHeight;
    this.rockAOCC = props.rockAOCC;

    this.stoneDiff = props.stoneDiff;
    this.stoneNormal = props.stoneNormal;
    this.stoneAOCC = props.stoneAOCC;

    this.groundDiff = props.groundDiff;
    this.groundNormal = props.groundNormal;
    this.groundHeight = props.groundHeight;
    this.groundAOCC = props.groundAOCC;

    this.grassDiff = props.grassDiff;
    this.grassNormal = props.grassNormal;
    this.grassHeight = props.grassHeight;
    this.grassAOCC = props.grassAOCC;

    this.mossDiff = props.mossDiff;

    this.initilize();
  }

  get scale(){
    return this._scale;
  }

  set scale(value){
    this._scale = value;
    console.log(this.shader.uniforms);
    this.shader.uniforms.uScale.value = value;
  }

  initilize() {
    this.onBeforeCompile = (shader) => {
      shader.uniforms.uRockDiff = { value: this.rockDiff };
      shader.uniforms.uRockNormal = { value: this.rockNormal };
      shader.uniforms.uRockHeight = { value: this.rockHeight };
      shader.uniforms.uRockAOCC = { value: this.rockAOCC };

      shader.uniforms.uStoneDiff = { value: this.stoneDiff };
      shader.uniforms.uStoneNormal = { value: this.stoneNormal };
      shader.uniforms.uStoneAOCC = { value: this.stoneAOCC };

      shader.uniforms.uGroundDiff = { value: this.groundDiff };
      shader.uniforms.uGroundNormal = { value: this.groundNormal };
      shader.uniforms.uGroundHeight = { value: this.groundHeight };
      shader.uniforms.uGroundAOCC = { value: this.groundAOCC };

      shader.uniforms.uGrassDiff = { value: this.grassDiff };
      shader.uniforms.uGrassNormal = { value: this.grassNormal };
      shader.uniforms.uGrassHeight = { value: this.grassHeight };
      shader.uniforms.uGrassAOCC = { value: this.grassAOCC };

      shader.uniforms.uMossDiff = { value: this.mossDiff };
      shader.uniforms.uFaceBlendExponent = { value: 50.0 };

      shader.uniforms.uScale = {value: this._scale};

      shader.vertexShader = shader.vertexShader.replace(
        `#include <clipping_planes_pars_vertex>`,
        `
                    #include <clipping_planes_pars_vertex>
            
                    varying vec2 vUv;
                    uniform float uFaceBlendExponent;  // <-- NEW
                    uniform float uScale;
            
                    uniform sampler2D uRockHeight;
                    uniform sampler2D uGroundHeight;
                    uniform sampler2D uGrassHeight;
            
                    varying float facing;
                    varying vec3 vWorldPosition;
                    varying vec3 vWorldNormal;
                    varying mat3 vTBN;

                    varying float noiseSum;

                    attribute float distToCrease;
            
                    vec3 orthogonal(vec3 v) {
                        return normalize(abs(v.x) > abs(v.z)
                        ? vec3(-v.y, v.x, 0.0)
                        : vec3(0.0, -v.z, v.y));
                    }
            
                    float repeatInRange(float val, float minVal, float maxVal) {
                        return mod(val - minVal, maxVal - minVal) + minVal;
                    }

                    float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
                    vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
                    vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

                    float snoise(vec3 p){
                        vec3 a = floor(p);
                        vec3 d = p - a;
                        d = d * d * (3.0 - 2.0 * d);

                        vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
                        vec4 k1 = perm(b.xyxy);
                        vec4 k2 = perm(k1.xyxy + b.zzww);

                        vec4 c = k2 + a.zzzz;
                        vec4 k3 = perm(c);
                        vec4 k4 = perm(c + 1.0);

                        vec4 o1 = fract(k3 * (1.0 / 41.0));
                        vec4 o2 = fract(k4 * (1.0 / 41.0));

                        vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
                        vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

                        return o4.y * d.y + o4.x * (1.0 - d.y);
                    }

                    float noise(vec3 point){
                        noiseSum = 0.0;

                        float totalAmplitude = 1.0;
                        float scale = 2.0;

                        for(int i = 0; i < 6; i++){
                            noiseSum += snoise(point * scale) * totalAmplitude;
                            scale *= .01;
                            totalAmplitude *= .9;
                        }

                        return clamp(pow(noiseSum, 3.0), 0.0, 1.0);
                    }
                `
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <fog_vertex>`,
        `
                    #include <fog_vertex>

                    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    vUv = uv; 
                    noiseSum = noise(vWorldPosition);
            
                    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
                    vWorldNormal = worldNormal;
            
                    // Calculate x/z components and apply exponent
                    vec3 N = normalize(vWorldNormal);

                    float xComp = pow(abs(N.x), uFaceBlendExponent);
                    float zComp = pow(abs(N.z), uFaceBlendExponent);

                    float total = xComp + zComp + 1e-8;
                    
                    float xWeight = xComp / total;
                    float zWeight = zComp / total;
            
                    // Sample two UV sets
                    vec2 uvX = fract(vec2(
                        repeatInRange(vWorldPosition.x / 50.0, 0.0, 300.0),
                        repeatInRange(vWorldPosition.y / 50.0, 0.0, 300.0)
                    ));
                    vec2 uvZ = fract(vec2(
                        repeatInRange(vWorldPosition.z / 50.0, 0.0, 300.0),
                        repeatInRange(vWorldPosition.y / 50.0, 0.0, 300.0)
                    ));
            
                    // Blend the rockHeight map to displace the vertex
                    vec3 xHeight = texture2D(uRockHeight, uvX).rgb;
                    vec3 zHeight = texture2D(uRockHeight, uvZ).rgb;

                    vec3 rockHeight = (xHeight * xWeight + zHeight * zWeight) / 2.0;

                    vec3 groundHeight = texture2D(uGroundHeight, fract((vUv * 50.0) * uScale)).rgb;
            
                    float heightScale = 10.0;
                    vec3 displacedPosition = position + normal * mix( (rockHeight * heightScale), groundHeight, facing);
            
                    // "Facing" for top-down blend
                    vec3 worldUp = vec3(0.0, 1.0, 0.0);
                    facing = clamp(dot(worldNormal, worldUp), 0.0, 1.0);
            
                    // Build TBN
                    vec3 modelTangent   = orthogonal(normal);
                    vec3 worldTangent   = normalize(mat3(modelMatrix) * modelTangent);
                    vec3 wNormal        = normalize(worldNormal);
                    vec3 worldBitangent = normalize(cross(wNormal, worldTangent));
                    vTBN = mat3(worldTangent, worldBitangent, wNormal);
            
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
                `
      );

      // Modify the fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        `uniform float opacity;`,
        `
                    uniform float opacity;
                    varying float facing;
                    varying vec3 vWorldPosition;
                    varying vec3 vWorldNormal;
                    varying vec2 vUv;
                    varying mat3 vTBN;
                    varying float noiseSum;

                    uniform float uScale;
            
                    uniform sampler2D uRockNormal;
                    uniform sampler2D uRockDiff;
                    uniform sampler2D uRockAOCC;

                    uniform sampler2D uStoneDiff;
                    uniform sampler2D uStoneNormal;
                    uniform sampler2D uStoneAOCC;

                    uniform sampler2D uGroundDiff;
                    uniform sampler2D uGroundNormal;
                    uniform sampler2D uGroundAOCC;

                    uniform sampler2D uGrassDiff;
                    uniform sampler2D uGrassNormal;
                    uniform sampler2D uGrassAOCC;

                    uniform sampler2D uMossDiff;
                    
                    uniform float uFaceBlendExponent;  // <-- NEW
            
                    float repeatInRange(float val, float minVal, float maxVal) {
                        return mod(val - minVal, maxVal - minVal) + minVal;
                    }


                    float derivativeScreenSpace(vec3 normal, float thresholdLow, float thresholdHigh){
                        vec3 dNdx = dFdx(normal);
                        vec3 dNdy = dFdy(normal);
                        
                        // Compute the screen-space derivatives of the UV coordinates:
                        vec2 dUvdx = dFdx(vUv);
                        vec2 dUvdy = dFdy(vUv);
                        float uvDerivative = (length(dUvdx) + length(dUvdy)) / cameraPosition.x;
                        uvDerivative = max(uvDerivative, 1.0); // Prevent division by zero
                        
                        // Compute curvature in a distance-invariant way:
                        float curvature = (length(dNdx) + length(dNdy)) / uvDerivative;

                        return smoothstep(thresholdLow, thresholdHigh, curvature);
                    }

                    float derivativeWorldSpace(vec3 normal, float thresholdLow, float thresholdHigh) {
                        // Derivatives of the normal in world space
                        vec3 dNdx = dFdx(normal);
                        vec3 dNdy = dFdy(normal);
                        
                        // Derivatives of the position in world space
                        vec3 dWdx = dFdx(vWorldPosition);
                        vec3 dWdy = dFdy(vWorldPosition);

                        // Compute a distance-invariant "scale" from the world-space derivatives
                        float posDerivative = (length(dWdx) + length(dWdy));
                        posDerivative = max(posDerivative, 1e-8); // Avoid division by zero

                        // Calculate curvature
                        float curvature = (length(dNdx) + length(dNdy)) / posDerivative;

                        // Smoothstep between your chosen thresholds
                        return smoothstep(thresholdLow, thresholdHigh, curvature);
                    }
                `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `
                    // Original normal calculations
                    #include <normal_fragment_begin>

                    float maxDist = 5.0;
            
                    vec3 N = normalize(vWorldNormal);


                    //Rock Face Normal Calculations
                    float xComp = pow(abs(N.x), uFaceBlendExponent);
                    float zComp = pow(abs(N.z), uFaceBlendExponent);

                    float total = xComp + zComp + 1e-8;

                    float zWeight = xComp / total;
                    float xWeight = zComp / total;
            
                    vec2 uvX = fract(vec2(
                        repeatInRange(vWorldPosition.x / 50.0, 0.0, 300.0),
                        repeatInRange(vWorldPosition.y / 50.0, 0.0, 300.0)
                    ) * uScale);

                    vec2 uvZ = fract(vec2(
                        repeatInRange(vWorldPosition.z / 50.0, 0.0, 300.0),
                        repeatInRange(vWorldPosition.y / 50.0, 0.0, 300.0)
                    ) * uScale);
            
                    vec3 xRockColor = texture2D(uRockDiff, uvX).rgb;
                    vec3 zRockColor = texture2D(uRockDiff, uvZ).rgb;

                    vec3 xRockAOCC = texture2D(uRockAOCC, uvX).rgb;
                    vec3 zRockAOCC = texture2D(uRockAOCC, uvZ).rgb;

                    vec3 xRockNormal = texture2D(uRockNormal, uvX).rgb;
                    vec3 zRockNormal = texture2D(uRockNormal, uvZ).rgb;
                    
                    xRockNormal = (xRockNormal * 2.0 - 1.0) * 2.0;
                    zRockNormal = (zRockNormal * 2.0 - 1.0) * 2.0;
                    
                    vec3 rockColor = xRockColor * xRockAOCC * xWeight + zRockColor * zWeight * zRockAOCC;

                    vec3 rockNormal = xRockNormal * xWeight + zRockNormal * zWeight;
                    rockNormal = (rockNormal * 2.0 - 1.0) * 2.0;
                    
                    //Rock Crack calculations
                    vec3 worldUp = vec3(0.0, 1.0, 0.0);

                    float topDownFactor = clamp(dot(N, worldUp), 0.0, 1.0);
                    float rockFacing = clamp(dot(rockNormal , worldUp), 0.0, 1.0);

                    //float rockCrackFactor = derivativeScreenSpace(rockNormal, .3, 1.0);


                    // vec3 stoneColor = texture2D(uStoneDiff, fract((vUv * 20.0) * uScale)).rgb;
                    // vec3 stoneNormal = texture2D(uStoneNormal, fract((vUv * 20.0) * uScale)).rgb * 10.0;
                    // vec3 stoneAOCC = texture2D(uStoneAOCC, fract((vUv * 20.0) * uScale)).rgb;


                    //moss calculations
                    vec3 zMossColor = texture2D(uMossDiff, uvZ).rgb;
                    vec3 xMossColor = texture2D(uMossDiff, uvX).rgb;

                    vec3 mossColor = xMossColor * xWeight + zMossColor * zWeight;

                    if(rockColor.r < .2 && rockColor.g < .2 && rockColor.b < .2){
                        mossColor = texture2D(uMossDiff, fract(vUv * (100.0 * uScale) )).rgb;
                        rockColor =  mossColor;
                    }

                    
                    rockColor = mix(rockColor, mossColor, rockFacing );
                    // rockColor = mix(rockColor, mossColor, rockCrackFactor); 
                    

                    vec3 groundAOCC = texture2D(uGroundAOCC, fract(vUv * (100.0 * uScale))).rgb;
                    vec3 grassAOCC = texture2D(uGrassAOCC, fract(vUv * (100.0 * uScale))).rgb;

                    vec3 groundCol = texture2D(uGroundDiff, fract(vUv * (100.0 * uScale))).rgb * groundAOCC;
                    vec3 grassCol = texture2D(uGrassDiff, fract(vUv * (100.0 * uScale))).rgb * grassAOCC;


                    groundCol = mix( groundCol, mossColor, noiseSum );

                    vec3 finalCol = mix(rockColor, groundCol, pow(facing, 8.0));

                    diffuseColor.rgb = finalCol;

                    vec3 cloverNormal = texture2D(uGroundNormal, fract(vUv * (100.0 * uScale))).rgb;
                    vec3 grassNormal = texture2D(uGrassNormal, fract(vUv * (100.0 * uScale))).rgb;

                    cloverNormal = (cloverNormal * 2.0 - 1.0) * 4.0;
                    grassNormal = (grassNormal * 2.0 - 1.0) * 4.0;

                    vec3 groundNormal = mix(grassNormal, cloverNormal, min(max(pow(noiseSum, 3.0), .2), 1.0));
                    
                    vec3 blendedNormal = mix(rockNormal, groundNormal, pow(facing, 8.0));
            
                    // Transform normal to world space
                    vec3 rockNormalWorld = normalize(blendedNormal);
            
                    // Blend final normal with geometry normal based on "facing"
                    normal = mix(rockNormalWorld, normal, topDownFactor);
                `
      );

      this.shader = shader;
    };
  }
}
