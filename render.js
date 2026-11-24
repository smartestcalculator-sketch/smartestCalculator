"use strict";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import * as THREE from "three";

export const RENDER_CONFIG = {
  background: "#090a05",
  exposure: 0.52,
  pixelSize: 3,

  ambient: {
    sky: "#579554",
    ground: "#0d3a41",
    intensity: 0.12,
  },

  keyLight: {
    color: "#94b196",
    intensity: 1.35,
    position: [0, 9, 1.2],
  },

  redLight: {
    color: "#ff1825",
    intensity: 2.0,
    position: [0, 0.5, 1.5],
    distance: 5,
  },

  screenLight: {
    color: "#29ff66",
    intensity: 0.08,
    position: [6, 2, 3],
    distance: 3.5,
  },
  greenFill: {
    color: "#46ff78",
    intensity: 8.0,
    width: 4.0,
    height: 5.0,

    offsetX: 0.8,
    offsetY: 1.5,
    offsetZ: 3.0,
  },
};

export const ROBOT_MATERIALS = {
  eye_M: {
    color: "#a80618",
    emissive: "#ff182c",
    emissiveIntensity: 4.0,
    metalness: 0,
    roughness: 0.32,
  },
  eyeInside_M: { color: "#202b43", metalness: 0, roughness: 0.5 },
  body_M: {
    colorA: "rgb(185, 183, 181)",
    colorB: "#3f3c3b",
    metalness: 0.473,
    roughness: 0.5,
    noiseScale: 120,
    noiseDetail: 5,
    noiseRoughness: 0.5,
    noiseLacunarity: 2,
    noiseDistortion: 0.25,
    threshold: 0.72,
    edgeSoftness: 0.025,
  },
  metal_M: { color: "#686560", metalness: 0.255, roughness: 0.5 },
  eyeline_M: { color: "#78877c", metalness: 0, roughness: 0.5 },
};

// Change this value to the exact Blender material name.
const CONTAINER_MATERIAL_NAME = "Water Jelly";
export const CONTAINER_LIGHT_MATERIAL_NAME = "Light";

export const CONTAINER_MATERIAL = {
  colorDark: "#073d11",
  colorBright: "#48ff0a",
  metalness: 0,
  roughness: 0.7,
  ior: 0.2,
  opacity: 0.3,
  mixFactor: 0,
  voronoiScale: 35,
  noiseScale: 5,
  roughnessScale: 2,
  bumpScale: 20,
  bumpStrength: 0.03,
  secondaryBumpScale: 3.5,
  secondaryBumpStrength: 0.35,
  edgeStrength: 0.85,
};
export const BRAIN_MATERIAL = {
  colorA: "#a32128",
  colorB: "#e969a5",
  textureFillStrength: 0.24,
  rimColor: "#ffe7e2",
  rimStrength: 0.14,

  noiseScale: 30.0,
  noiseDetail: 8,
  noiseRoughness: 0.5,
  noiseLacunarity: 2.0,
  noiseDistortion: 0.0,

  threshold: 0.52,
};

export const CERAMIC_MATERIAL = {
  color: "#c8c2bb",
  glazeColor: "#a79c90",

  glazeScale: 2.0,
  glazeStrength: 0.18,

  baseRoughness: 0.05,
  surfaceRoughness: 0.15,

  bumpScale: 80.0,
  bumpStrength: 0.04,

  coatWeight: 1.0,
  coatRoughness: 0.03,
  ior: 1.55,
};

export function setupRenderer(renderer, scene) {
  scene.background = new THREE.Color(RENDER_CONFIG.background);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDER_CONFIG.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

export function resizeRenderSurface(renderer, width, height) {
  // 只降低 WebGL 畫布的取樣解析度，保留網頁和攝影機的顯示比例。
  const pixelSize = RENDER_CONFIG.pixelSize;
  renderer.setSize(
    Math.max(1, Math.ceil(width / pixelSize)),
    Math.max(1, Math.ceil(height / pixelSize)),
    false,
  );
}

export function setupLighting(scene) {
  const c = RENDER_CONFIG;

  const ambient = new THREE.HemisphereLight(
    c.ambient.sky,
    c.ambient.ground,
    c.ambient.intensity,
  );
  scene.add(ambient);

  const key = new THREE.DirectionalLight(
    c.keyLight.color,
    c.keyLight.intensity,
  );
  key.position.set(...c.keyLight.position);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const red = new THREE.PointLight(
    c.redLight.color,
    c.redLight.intensity,
    c.redLight.distance,
  );
  red.position.set(...c.redLight.position);
  scene.add(red);

  const screen = new THREE.PointLight(
    c.screenLight.color,
    c.screenLight.intensity,
    c.screenLight.distance,
  );
  screen.position.set(...c.screenLight.position);
  scene.add(screen);

  const greenFill = new THREE.RectAreaLight(
    RENDER_CONFIG.greenFill.color,
    RENDER_CONFIG.greenFill.intensity,
    RENDER_CONFIG.greenFill.width,
    RENDER_CONFIG.greenFill.height,
  );

  greenFill.name = "RobotGreenAreaLight";

  scene.add(greenFill);

  return {
    ambient,
    key,
    red,
    screen,
    greenFill,
  };
}

function makeStandard(source, config) {
  const material = source.isMeshStandardMaterial
    ? source.clone()
    : new THREE.MeshStandardMaterial();

  material.name = source.name;
  material.color.set(config.color);
  material.map = null;
  material.metalness = config.metalness;
  material.roughness = config.roughness;

  if (config.emissive) {
    material.emissive.set(config.emissive);
    material.emissiveIntensity = config.emissiveIntensity ?? 1;
  }

  material.needsUpdate = true;
  return material;
}

const NOISE_GLSL = `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise31(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = mix(hash31(i), hash31(i + vec3(1.,0.,0.)), f.x);
    float b = mix(hash31(i + vec3(0.,1.,0.)), hash31(i + vec3(1.,1.,0.)), f.x);
    float c = mix(hash31(i + vec3(0.,0.,1.)), hash31(i + vec3(1.,0.,1.)), f.x);
    float d = mix(hash31(i + vec3(0.,1.,1.)), hash31(i + vec3(1.,1.,1.)), f.x);

    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
  }

  float fbm31(vec3 p) {
    float s = 0.;
    float amp = 0.5;
    float norm = 0.;

    for (int i = 0; i < 5; i++) {
      s += noise31(p) * amp;
      norm += amp;
      p *= 2.;
      amp *= 0.5;
    }

    return s / norm;
  }
`;

function addLocalPosition(shader) {
  shader.vertexShader =
    `varying vec3 vCustomLocalPosition;\n` + shader.vertexShader;

  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\n vCustomLocalPosition = position;",
  );

  shader.fragmentShader =
    `varying vec3 vCustomLocalPosition;\n${NOISE_GLSL}\n` +
    shader.fragmentShader;
}

function makeBody(source, mesh) {
  const c = ROBOT_MATERIALS.body_M;

  const m = source.isMeshStandardMaterial
    ? source.clone()
    : new THREE.MeshStandardMaterial();

  m.name = source.name;
  m.color.set("#ffffff");
  m.map = null;
  m.metalness = c.metalness;
  m.roughness = c.roughness;

  mesh.geometry.computeBoundingBox();

  const bounds = mesh.geometry.boundingBox;
  const min = bounds.min.clone();
  const size = bounds.getSize(new THREE.Vector3());

  size.set(
    Math.max(size.x, 0.0001),
    Math.max(size.y, 0.0001),
    Math.max(size.z, 0.0001),
  );

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uColorA = {
      value: new THREE.Color(c.colorA),
    };

    shader.uniforms.uColorB = {
      value: new THREE.Color(c.colorB),
    };

    shader.uniforms.uBodyMin = { value: min };
    shader.uniforms.uBodySize = { value: size };
    shader.uniforms.uBodyScale = { value: c.noiseScale };
    shader.uniforms.uBodyThreshold = { value: c.threshold };
    shader.uniforms.uBodySoftness = { value: c.edgeSoftness };

    addLocalPosition(shader);

    shader.fragmentShader =
      `
      uniform vec3 uColorA, uColorB, uBodyMin, uBodySize;
      uniform float uBodyScale, uBodyThreshold, uBodySoftness;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
  #include <color_fragment>

  // Normalize local coordinates
  vec3 p = (
    (vCustomLocalPosition - uBodyMin) /
    uBodySize
  ) * uBodyScale;

  // Distort the pattern slightly
  vec3 warpedP = p + vec3(
    noise31(p * 0.37),
    noise31(p * 0.43 + 17.0),
    noise31(p * 0.39 + 31.0)
  ) * 0.18;

  // Small independent cellular spots
  vec3 cell = floor(warpedP);
  vec3 f = fract(warpedP);

  vec3 center = vec3(
    0.5 + (hash31(cell + vec3(1.0)) - 0.5) * 0.4,
    0.5 + (hash31(cell + vec3(2.0)) - 0.5) * 0.4,
    0.5 + (hash31(cell + vec3(3.0)) - 0.5) * 0.4
  );

  vec3 d = f - center;

  // Stretch each spot into irregular short marks
  float stretch = mix(
    0.55,
    1.5,
    hash31(cell + vec3(4.0))
  );

  d.x *= stretch;
  d.y /= stretch;

  float spotDistance = length(d);

  // Randomize spot size
  float spotRadius = mix(
    0.08,
    0.26,
    hash31(cell + vec3(5.0))
  );

  // Some cells remain empty
  float spotEnabled = step(
    0.30,
    hash31(cell + vec3(6.0))
  );

  float spotMask =
    (1.0 - smoothstep(
      spotRadius - 0.025,
      spotRadius + 0.025,
      spotDistance
    )) * spotEnabled;

  diffuseColor.rgb *= mix(
    uColorA,
    uColorB,
    spotMask
  );
  `,
    );
  };

  m.customProgramCacheKey = () => "body-noise-v3";
  m.needsUpdate = true;

  return m;
}

const VORONOI_GLSL = `
  float voronoi31(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    float result = 1.0;

    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 d = vec3(
            float(x),
            float(y),
            float(z)
          );

          vec3 neighbor = cell + d;

          vec3 randomPoint = vec3(
            hash31(neighbor),
            hash31(neighbor + vec3(11.0)),
            hash31(neighbor + vec3(37.0))
          );

          vec3 seed = d + randomPoint - f;

          result = min(
            result,
            length(seed)
          );
        }
      }
    }

    return result;
  }
`;

function makeContainer(source) {
  const c = CONTAINER_MATERIAL;
  const darkColor = { value: new THREE.Color(c.colorDark) };
  const brightColor = { value: new THREE.Color(c.colorBright) };
  const normalDark = darkColor.value.clone();
  const normalBright = brightColor.value.clone();
  const readingDark = new THREE.Color("#1d5c51");
  const readingBright = new THREE.Color("#476342");
  const readingEmissive = new THREE.Color("#36533a");
  const transitionMs = 550;

  const m = new THREE.MeshPhysicalMaterial({
    name: source.name,
    color: "#ffffff",

    metalness: c.metalness,
    roughness: c.roughness,
    ior: c.ior,

    emissive: "#27ff45",
    emissiveIntensity: 0.55,

    transparent: true,
    opacity: c.opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const normalEmissive = m.emissive.clone();
  const normalEmissiveIntensity = m.emissiveIntensity;
  let readingProgress = 0;
  let previousFrameTime;
  m.onBeforeRender = () => {
    const reading = document.body.dataset.phase === "reading";
    const now = performance.now();
    const step = Math.min(now - (previousFrameTime ?? now), 50) / transitionMs;
    previousFrameTime = now;
    const next = THREE.MathUtils.clamp(readingProgress + (reading ? step : -step), 0, 1);
    if (next === readingProgress) return;
    readingProgress = next;

    // 同步漸變液體的深淺色與自發光，中途切換階段時從目前的顏色折返。
    const blend = THREE.MathUtils.smoothstep(readingProgress, 0, 1);
    darkColor.value.copy(normalDark).lerp(readingDark, blend);
    brightColor.value.copy(normalBright).lerp(readingBright, blend);
    m.emissive.copy(normalEmissive).lerp(readingEmissive, blend);
    m.emissiveIntensity = THREE.MathUtils.lerp(normalEmissiveIntensity, 0.76, blend);
  };

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uContainerDark = darkColor;
    shader.uniforms.uContainerBright = brightColor;

    shader.uniforms.uContainerVoronoiScale = {
      value: c.voronoiScale,
    };

    shader.uniforms.uContainerNoiseScale = {
      value: c.noiseScale,
    };

    shader.uniforms.uContainerMix = {
      value: c.mixFactor,
    };

    shader.uniforms.uContainerEdge = {
      value: c.edgeStrength,
    };

    shader.uniforms.uContainerRoughnessScale = {
      value: c.roughnessScale,
    };

    shader.uniforms.uContainerBumpScale = {
      value: c.bumpScale,
    };

    shader.uniforms.uContainerBumpStrength = {
      value: c.bumpStrength,
    };

    shader.uniforms.uContainerSecondaryBumpScale = {
      value: c.secondaryBumpScale,
    };

    shader.uniforms.uContainerSecondaryBumpStrength = {
      value: c.secondaryBumpStrength,
    };

    addLocalPosition(shader);

    shader.vertexShader =
      `varying vec3 vContainerViewNormal;\n` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <defaultnormal_vertex>",
      "#include <defaultnormal_vertex>\n vContainerViewNormal = normalize(transformedNormal);",
    );

    shader.fragmentShader =
      `
      varying vec3 vContainerViewNormal;

      uniform vec3 uContainerDark, uContainerBright;

      uniform float uContainerVoronoiScale;
      uniform float uContainerNoiseScale;
      uniform float uContainerMix;
      uniform float uContainerEdge;
      uniform float uContainerRoughnessScale;
      uniform float uContainerBumpScale;
      uniform float uContainerBumpStrength;
      uniform float uContainerSecondaryBumpScale;
      uniform float uContainerSecondaryBumpStrength;

   float hash31(vec3 p);
${VORONOI_GLSL}
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>

      vec3 cp = vCustomLocalPosition;

      float cells = voronoi31(
        cp * uContainerVoronoiScale
      );

      float organic = fbm31(
        cp * uContainerNoiseScale
      );

      float greenMix = clamp(
        (1.0 - cells) * organic * 1.8,
        0.0,
        1.0
      );

      vec3 green = mix(
        uContainerDark,
        uContainerBright,
        greenMix
      );

      diffuseColor.rgb *= green;
float glowMask = smoothstep(
  0.25,
  0.85,
  greenMix
);

totalEmissiveRadiance +=
  green * glowMask * 0.35;
      float facing = abs(dot(
        normalize(vContainerViewNormal),
        normalize(vViewPosition)
      ));

      float rim = pow(
        1.0 - clamp(facing, 0.0, 1.0),
        2.0
      );

      diffuseColor.a *= mix(
        0.40,
        1.0,
        clamp(
          uContainerMix + rim * uContainerEdge,
          0.0,
          1.0
        )
      );
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      #include <roughnessmap_fragment>

      roughnessFactor = clamp(
        roughnessFactor * mix(
          0.78,
          1.2,
          fbm31(
            vCustomLocalPosition *
            uContainerRoughnessScale
          )
        ),
        0.05,
        1.0
      );
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>

      float bump1 = fbm31(
        vCustomLocalPosition * uContainerBumpScale
      );

      float bump2 = fbm31(
        vCustomLocalPosition *
        uContainerSecondaryBumpScale
      );

      float h =
        bump1 * uContainerBumpStrength +
        bump2 * uContainerSecondaryBumpStrength;

      normal = normalize(
        normal + vec3(dFdx(h), dFdy(h), 0.0)
      );
      `,
    );
  };

  m.customProgramCacheKey = () => "container-organic-v1";
  m.needsUpdate = true;

  return m;
}

function makeBrain(source) {
  const c = BRAIN_MATERIAL;

  const material = new THREE.MeshStandardMaterial({
    name: source.name,
    color: "#ffffff",
    metalness: 0.0,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBrainColorA = {
      value: new THREE.Color(c.colorA),
    };

    shader.uniforms.uBrainColorB = {
      value: new THREE.Color(c.colorB),
    };
    shader.uniforms.uBrainTextureFill = { value: c.textureFillStrength };
    shader.uniforms.uBrainRimColor = { value: new THREE.Color(c.rimColor) };
    shader.uniforms.uBrainRimStrength = { value: c.rimStrength };

    shader.uniforms.uBrainScale = {
      value: c.noiseScale,
    };

    shader.uniforms.uBrainThreshold = {
      value: c.threshold,
    };

    shader.uniforms.uBrainRoughness = {
      value: c.noiseRoughness,
    };

    shader.uniforms.uBrainLacunarity = {
      value: c.noiseLacunarity,
    };

    shader.uniforms.uBrainDetail = {
      value: c.noiseDetail,
    };

    shader.vertexShader =
      `
      varying vec3 vBrainPosition;
      varying vec3 vBrainNormal;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      vBrainPosition = position;
      vBrainNormal = normal;
      `,
    );

    shader.fragmentShader =
      `
      varying vec3 vBrainPosition;
      varying vec3 vBrainNormal;

      uniform vec3 uBrainColorA;
      uniform vec3 uBrainColorB;
      uniform float uBrainTextureFill;
      uniform vec3 uBrainRimColor;
      uniform float uBrainRimStrength;

      uniform float uBrainScale;
      uniform float uBrainThreshold;
      uniform float uBrainRoughness;
      uniform float uBrainLacunarity;
      uniform float uBrainDetail;

      float brainHash(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float brainNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);

        f = f * f * (3.0 - 2.0 * f);

        float n000 = brainHash(i);
        float n100 = brainHash(i + vec3(1.0, 0.0, 0.0));
        float n010 = brainHash(i + vec3(0.0, 1.0, 0.0));
        float n110 = brainHash(i + vec3(1.0, 1.0, 0.0));

        float n001 = brainHash(i + vec3(0.0, 0.0, 1.0));
        float n101 = brainHash(i + vec3(1.0, 0.0, 1.0));
        float n011 = brainHash(i + vec3(0.0, 1.0, 1.0));
        float n111 = brainHash(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);

        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);

        return mix(nxy0, nxy1, f.z);
      }

      float brainFBM(vec3 p) {
        float total = 0.0;
        float amplitude = 1.0;
        float weight = 0.0;
        float frequency = 1.0;

        for (int i = 0; i < 8; i++) {
          float octaveWeight = clamp(
            uBrainDetail - float(i),
            0.0,
            1.0
          );

          total += brainNoise(p * frequency)
            * amplitude * octaveWeight;

          weight += amplitude * octaveWeight;

          amplitude *= uBrainRoughness;
          frequency *= uBrainLacunarity;
        }

        return total / max(weight, 0.0001);
      }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>

      vec3 brainCoordinates = vBrainPosition * uBrainScale;

      float brainValue = brainFBM(brainCoordinates);

      float brainMask = smoothstep(
        uBrainThreshold - 0.08,
        uBrainThreshold + 0.08,
        brainValue
      );

      vec3 brainColor = mix(
        uBrainColorA,
        uBrainColorB,
        brainMask
      );

      float topLight = clamp(
        normalize(vBrainNormal).y * 0.5 + 0.5,
        0.0,
        1.0
      );

      brainColor *= mix(0.82, 1.12, topLight);

      diffuseColor.rgb = brainColor;
      `,
    );

    // 只補大腦的紋理與輪廓，保留原有的場景光照計算。
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `
      #include <emissivemap_fragment>
      float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      float rim = pow(1.0 - facing, 3.0);
      totalEmissiveRadiance += diffuseColor.rgb * uBrainTextureFill;
      totalEmissiveRadiance += uBrainRimColor * (rim * uBrainRimStrength);
      `,
    );
  };

  material.customProgramCacheKey = () => "brain-procedural-v3";

  material.needsUpdate = true;

  console.log("[Shader] Brain material applied:", source.name);

  return material;
}

function makeCeramic(source) {
  const c = CERAMIC_MATERIAL;

  const material = new THREE.MeshPhysicalMaterial({
    name: source.name,
    color: "#ffffff",

    metalness: 0.0,
    roughness: c.baseRoughness,
    ior: c.ior,

    clearcoat: c.coatWeight,
    clearcoatRoughness: c.coatRoughness,

    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCeramicColor = {
      value: new THREE.Color(c.color),
    };

    shader.uniforms.uCeramicGlazeColor = {
      value: new THREE.Color(c.glazeColor),
    };

    shader.uniforms.uCeramicGlazeScale = {
      value: c.glazeScale,
    };

    shader.uniforms.uCeramicGlazeStrength = {
      value: c.glazeStrength,
    };

    shader.uniforms.uCeramicRoughness = {
      value: c.surfaceRoughness,
    };

    shader.uniforms.uCeramicBumpScale = {
      value: c.bumpScale,
    };

    shader.uniforms.uCeramicBumpStrength = {
      value: c.bumpStrength,
    };

    addLocalPosition(shader);

    shader.fragmentShader =
      `
      uniform vec3 uCeramicColor;
      uniform vec3 uCeramicGlazeColor;

      uniform float uCeramicGlazeScale;
      uniform float uCeramicGlazeStrength;
      uniform float uCeramicRoughness;
      uniform float uCeramicBumpScale;
      uniform float uCeramicBumpStrength;
    ` + shader.fragmentShader;

    // Ceramic glaze color
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>

      float glazeNoise = fbm31(
        vCustomLocalPosition * uCeramicGlazeScale
      );

      float glazeMask = smoothstep(
        0.28,
        0.75,
        glazeNoise
      ) * uCeramicGlazeStrength;

      vec3 ceramicColor = mix(
        uCeramicColor,
        uCeramicGlazeColor,
        glazeMask
      );

      diffuseColor.rgb *= ceramicColor;
      `,
    );

    // Ceramic surface roughness
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      #include <roughnessmap_fragment>

      float ceramicSurfaceNoise = fbm31(
        vCustomLocalPosition * uCeramicBumpScale
      );

      roughnessFactor = clamp(
        roughnessFactor +
        ceramicSurfaceNoise * uCeramicRoughness,
        0.025,
        1.0
      );
      `,
    );

    // Procedural ceramic bump
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>

      float ceramicHeight = fbm31(
        vCustomLocalPosition * uCeramicBumpScale
      );

      vec3 ceramicDx = dFdx(-vViewPosition);
      vec3 ceramicDy = dFdy(-vViewPosition);

      vec3 ceramicR1 = cross(ceramicDy, normal);
      vec3 ceramicR2 = cross(normal, ceramicDx);

      float ceramicDet = dot(ceramicDx, ceramicR1);

      normal = normalize(
        abs(ceramicDet) * normal -
        sign(ceramicDet) * (
          dFdx(ceramicHeight) * ceramicR1 +
          dFdy(ceramicHeight) * ceramicR2
        ) * uCeramicBumpStrength
      );
      `,
    );
  };

  material.customProgramCacheKey = () => "white-ceramic-v1";

  material.needsUpdate = true;

  console.log("[Shader] Ceramic material applied:", source.name);

  return material;
}

function makeBackgroundFlicker(source, isRedLamp) {
  const material = source.clone();
  const baseColor = material.color.clone();
  const baseEmissive = isRedLamp ? material.emissive.clone() : null;
  const steadyMinMs = isRedLamp ? 900 : 450;
  const steadyVariationMs = isRedLamp ? 3900 : 2700;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let nextChange = 0;
  let interrupted = false;

  material.onBeforeRender = () => {
    if (reducedMotion.matches) {
      material.color.copy(baseColor);
      if (isRedLamp) material.emissive.copy(baseEmissive);
      interrupted = false;
      nextChange = 0;
      return;
    }

    const now = performance.now();
    if (now < nextChange) return;

    // 每個材質獨立抽取亮度與停留時間，紅燈使用較長的隨機間隔。
    let brightness;
    if (interrupted || nextChange === 0) {
      brightness = 0.85 + Math.random() * 0.45;
      nextChange = now + steadyMinMs + Math.random() * steadyVariationMs;
      interrupted = false;
    } else {
      const blackout = Math.random() < 0.3;
      brightness = blackout ? 0.02 : 0.18 + Math.random() * 0.45;
      nextChange = now + (blackout ? 220 : 90) + Math.random() * (blackout ? 620 : 220);
      interrupted = true;
    }
    material.color.copy(baseColor).multiplyScalar(brightness);
    if (isRedLamp) {
      material.emissive.copy(baseEmissive).multiplyScalar(brightness);
    }
  };

  return material;
}

export function setupMaterials(model) {
  const supported =
    model.name === "robot" ||
    model.name === "container" ||
    model.name === "brain" ||
    model.name === "background";

  if (!supported) return;

  model.traverse((mesh) => {
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const sources = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    const updated = sources.map((source) => {
      if (!source) return source;

      const name = source.name.replace(/\.\d{3}$/, "");

      if (model.name === "background" && (name === "TV" || name === "eye_M")) {
        return makeBackgroundFlicker(source, name === "eye_M");
      }

// Background ceramic material
if (
  model.name === "background" &&
  name.toLowerCase().includes("white ceramic")
) {
  const material = makeCeramic(source);

  // Darken the ceramic shader colors
  material.onBeforeCompile = ((originalCompile) => {
    return (shader, renderer) => {
      originalCompile(shader, renderer);

      shader.uniforms.uCeramicColor.value.multiplyScalar(0.23);
      shader.uniforms.uCeramicGlazeColor.value.multiplyScalar(0.18);
    };
  })(material.onBeforeCompile);

  material.needsUpdate = true;

  return material;
}

// Brain material
if (model.name === "brain") {
  return makeBrain(source);
}

      console.log("[Material]", model.name, mesh.name, source.name);

      if (model.name === "container" && name === CONTAINER_MATERIAL_NAME) {
        console.log("[Shader] Container material applied:", source.name);

        return makeContainer(source);
      }

      if (model.name === "container" && name === CONTAINER_LIGHT_MATERIAL_NAME) {
        // 燈罩保留原材質，疊加淺黃綠色自發光。
        source.emissive.set("#e4ff9e");
        source.emissiveIntensity = 2.0;
        return source;
      }

      if (name === "body_M") {
        return makeBody(source, mesh);
      }

      if (ROBOT_MATERIALS[name]) {
        return makeStandard(source, ROBOT_MATERIALS[name]);
      }

      return source;
    });

    mesh.material = Array.isArray(mesh.material) ? updated : updated[0];
  });
}

export function createLightingUpdater(lights) {
  const { greenFill, screen } = lights;
  const baseFillColor = greenFill.color.clone();
  const baseScreenColor = screen.color.clone();
  const baseFillIntensity = greenFill.intensity;
  const baseScreenIntensity = screen.intensity;
  const redColor = new THREE.Color(RENDER_CONFIG.redLight.color);
  const colorTransitionSeconds = 1;
  let colorProgress = 0;
  let pulseBlend = 0;

  return (reaction, time, delta, reducedMotion) => {
    const timedOut = reaction === "timeout";
    const towardRed = reaction === "angry" || timedOut;
    const progressStep = delta / colorTransitionSeconds;
    colorProgress = THREE.MathUtils.clamp(
      colorProgress + (towardRed ? progressStep : -progressStep), 0, 1,
    );
    pulseBlend = THREE.MathUtils.damp(
      pulseBlend, timedOut && !reducedMotion ? 1 : 0, 8, delta,
    );

    // 每秒兩次平滑明暗變化，進出逾時狀態時也逐步增減閃爍幅度。
    const wave = (1 - Math.cos(time * 4 * Math.PI)) / 2;
    const pulse = pulseBlend * wave;
    // 綠光先淡出到零，亮度歸零時切換色相，再淡入紅光。
    const redPhase = colorProgress >= 0.5;
    const fade = THREE.MathUtils.smoothstep(Math.abs(2 * colorProgress - 1), 0, 1);
    const brightness = fade * (1 - 0.8 * pulse);
    greenFill.color.copy(redPhase ? redColor : baseFillColor);
    screen.color.copy(redPhase ? redColor : baseScreenColor);
    greenFill.intensity = baseFillIntensity * brightness;
    screen.intensity = baseScreenIntensity * brightness;
    return pulse;
  };
}

export function updateEyeGlow(model, reaction, pulse) {
  if (!model) return;

  let intensity = 4.0 * (1 - 0.8 * pulse);

  if (reaction === "discarded" || reaction === "away") {
    intensity = 0.0;
  }

  model.traverse((object) => {
    if (!object.isMesh) return;

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (!material || !material.isMeshStandardMaterial) {
        continue;
      }

      const name = material.name.replace(/\.\d{3}$/, "");

      if (name !== "eye_M") continue;

      material.emissiveIntensity = intensity;
    }
  });

  return intensity;
}
