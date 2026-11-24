"use strict";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

import {
  CONTAINER_LIGHT_MATERIAL_NAME,
  setupRenderer,
  resizeRenderSurface,
  setupLighting,
  setupMaterials,
  createLightingUpdater,
  updateEyeGlow,
} from "./render.js";

import {
  initRobotAnimation,
  updateRobotAnimation,
} from "./animation.js";
// ========================================
// CONFIGURATION
// ========================================

const CONFIG = {
  modelPath: "./glt/",
  models: ["robot", "container", "brain", "background"],

  cameraFov: 45,
  cameraDistance: 24,

  robotScreen: {
    x: 0.22,
    y: 0.7,
    width: 1.5,
    height: 1.5,
  },

  containerScreen: {
    x: 0.8,
    y: 0.5,
    width: 4,
    height: 4,
  },

  brainInside: {
    scale: 0.37,
    offsetX: 0,
    offsetY: 0,
    offsetZ: -0.05,
  },

  eyeLight: {
    x: 0,
    y: 0.5,
    z: 1.5,
  },

  background: {
    position: [-5, 10, -50],
    rotation: [0, 0.8, 0],
    scale: 4,
    castShadow: true,
    receiveShadow: true,
  },
  greenAreaLight: {
    enabled: true,
    color: "#3fd562",
    intensity: 3,

    widthRatio: 0.9,
    heightRatio: 0.8,

    offsetX: 0.45,
    offsetY: 0.15,
    offsetZ: 0.85,

    targetY: 0.08,
  },

  awayDistance: 0.55,
  discardDistance: 0.85,

  motionSpeed: 5,
  debug: true,
};

// ========================================
// INITIALIZATION
// ========================================

const canvas = document.getElementById("scene");
const loadStatus = document.getElementById("load-status");

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, 1, 0.01, 2000);

camera.position.set(0, 0, CONFIG.cameraDistance);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});

setupRenderer(renderer, scene);

const lights = setupLighting(scene);
const loader = new GLTFLoader();

const models = {};
const mixers = {};
const actions = {};
const modelSizes = {};

// ========================================
// MODEL GROUPS
// ========================================

const robotGroup = new THREE.Group();
robotGroup.name = "RobotController";
scene.add(robotGroup);

const containerController = new THREE.Group();
containerController.name = "ContainerController";
scene.add(containerController);

const containerGroup = new THREE.Group();
containerGroup.name = "ContainerMeshGroup";
containerController.add(containerGroup);

let brainRimLight;
const brainRimLightSize = new THREE.Vector3();

const brainGroup = new THREE.Group();
brainGroup.name = "BrainMeshGroup";
containerController.add(brainGroup);

const robotBasePosition = new THREE.Vector3();
const robotTargetPosition = new THREE.Vector3();

let robotLoaded = false;
let robotBaseScale = 1;
let containerBaseScale = 1;

function emphasisScale(model) {
  const phase = document.body.dataset.phase;
  if (model === "robot") {
    if (phase === "reading") return 1.3;
    if (phase === "answering") return 0.85;
  }
  if (model === "container" && phase === "answering") return 1.5;
  return 1;
}

const backgroundGroup = new THREE.Group();
backgroundGroup.name = "BackgroundController";

scene.add(backgroundGroup);

function updateBackgroundPlacement() {
  const config = CONFIG.background;

  backgroundGroup.position.set(...config.position);
  backgroundGroup.rotation.set(...config.rotation);
  backgroundGroup.scale.setScalar(config.scale);
}

updateBackgroundPlacement();

function addRoomLights(model) {
  const raycaster = new THREE.Raycaster();
  scene.updateMatrixWorld(true);

  // 從構圖上的兩個位置找出房間表面，讓局部光落在現有模型上。
  for (const [x, y, color] of [
    [-0.48, 0.44, "#89d477"],
    [0.32, 0.18, "#57ad63"],
  ]) {
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const [surface] = raycaster.intersectObject(model, true);
    if (!surface) continue;

    const light = new THREE.SpotLight(color, 175, 22, 0.55, 0.8);
    light.position.copy(surface.point).addScaledVector(raycaster.ray.direction, -8);
    light.target.position.copy(surface.point);
    scene.add(light, light.target);
  }
}

// ========================================
// RED EYE LIGHT
// ========================================

const robotLightAnchor = new THREE.Group();
robotLightAnchor.name = "RobotLightAnchor";

scene.add(robotLightAnchor);
robotLightAnchor.add(lights.red);

// ========================================
// EYE LIGHT CONTROLLER
// ========================================

const eyeLights = [];

lights.red.intensity = 0;

function setupEyeLights(robot) {
  const eyeNames = ["Eye_L", "Eye_R"];

  for (const name of eyeNames) {
    const eye = robot.getObjectByName(name);

    if (!eye || !eye.isMesh) {
      console.warn("[EyeLight] Mesh not found:", name);
      continue;
    }

    eye.geometry.computeBoundingBox();

    const center = eye.geometry.boundingBox.getCenter(new THREE.Vector3());

    const light = new THREE.PointLight("#ff182c", 0, 2, 2);

    light.name = `${name}_Light`;

    light.position.copy(center);
    light.position.z += 0.08;

    eye.add(light);
    eyeLights.push(light);
  }
}

function updateEyeLights(intensity) {
  if (intensity === undefined) return;

  for (const light of eyeLights) {
    light.intensity = intensity * 0.8;
  }
}

// ========================================
// GREEN AREA LIGHT
// ========================================

RectAreaLightUniformsLib.init();

// Replace any previous green fill light.
if (lights.greenFill) {
  lights.greenFill.removeFromParent();

  if (lights.greenFill.target) {
    lights.greenFill.target.removeFromParent();
  }
}

const greenConfig = CONFIG.greenAreaLight;

const greenAreaLight = new THREE.RectAreaLight(
  greenConfig.color,
  greenConfig.intensity,
  4,
  4,
);

greenAreaLight.name = "RobotGreenAreaLight";
greenAreaLight.visible = greenConfig.enabled;

scene.add(greenAreaLight);

lights.greenFill = greenAreaLight;
const updateLighting = createLightingUpdater(lights);

// ========================================
// SCREEN COORDINATES
// ========================================

function getScreenSize() {
  const distance = CONFIG.cameraDistance;

  const height =
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;

  return {
    width: height * camera.aspect,
    height,
  };
}

function getScreenPosition(x, y) {
  const screen = getScreenSize();

  return new THREE.Vector3(
    (x - 0.5) * screen.width,
    (0.5 - y) * screen.height,
    0,
  );
}

// ========================================
// MODEL BOUNDS
// ========================================

function centerModel(model) {
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);

  if (box.isEmpty()) {
    throw new Error(`[GLB] Empty geometry: ${model.name}`);
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  model.position.sub(center);

  return size;
}

function setupBrainRimLight(model) {
  const bounds = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((mesh) => {
    // GLTFLoader 將不同材質的 primitive 分成個別網格。
    if (!mesh.isMesh || mesh.material.name !== CONTAINER_LIGHT_MATERIAL_NAME) return;
    bounds.expandByObject(mesh, true);
  });
  if (bounds.isEmpty()) return;

  bounds.getSize(brainRimLightSize);
  const light = new THREE.RectAreaLight("#ffffff", 2.2);
  light.name = "BrainRimLight";
  bounds.getCenter(light.position);
  // 從燈罩上緣朝世界座標的正 Y 軸打光，避免面光源落在燈罩內部。
  light.position.y = bounds.max.y + 0.02;
  light.rotation.x = Math.PI / 2;
  containerGroup.add(light);
  brainRimLight = light;
}

function getFitScale(size, config) {
  const screen = getScreenSize();

  const targetWidth = screen.width * config.width;
  const targetHeight = screen.height * config.height;

  const distance = CONFIG.cameraDistance;
  const halfDepth = size.z * 0.5;

  const sizeX = Math.max(size.x, 0.0001);
  const sizeY = Math.max(size.y, 0.0001);

  const scaleX =
    (targetWidth * distance) / (sizeX * distance + targetWidth * halfDepth);

  const scaleY =
    (targetHeight * distance) / (sizeY * distance + targetHeight * halfDepth);

  const depthLimit = (0.7 * distance) / Math.max(halfDepth, 0.0001);

  return Math.max(0.0001, Math.min(scaleX, scaleY, depthLimit));
}

// ========================================
// ROBOT PLACEMENT
// ========================================

function updateRobotPlacement() {
  if (!models.robot || !robotLoaded) return;

  const config = CONFIG.robotScreen;
  const size = modelSizes.robot;

  const scale = getFitScale(size, config);

  robotBaseScale = scale;
  robotGroup.scale.setScalar(robotBaseScale * emphasisScale("robot"));

  robotBasePosition.copy(getScreenPosition(config.x, config.y));

  robotTargetPosition.copy(robotBasePosition);
  robotGroup.position.copy(robotBasePosition);

  updateGreenAreaLight();
}

// ========================================
// CONTAINER PLACEMENT
// ========================================

function updateContainerPlacement() {
  if (!models.container) return;

  const config = CONFIG.containerScreen;
  const size = modelSizes.container;

  const scale = getFitScale(size, config);

  containerBaseScale = scale;
  containerController.scale.setScalar(containerBaseScale * emphasisScale("container"));

  containerController.position.copy(getScreenPosition(config.x, config.y));
}

// ========================================
// BRAIN PLACEMENT
// ========================================

function updateBrainPlacement() {
  if (!models.brain || !models.container) return;

  const config = CONFIG.brainInside;

  const containerSize = modelSizes.container;
  const brainSize = modelSizes.brain;

  const fitScale = Math.min(
    containerSize.x / Math.max(brainSize.x, 0.0001),
    containerSize.y / Math.max(brainSize.y, 0.0001),
    containerSize.z / Math.max(brainSize.z, 0.0001),
  );

  brainGroup.scale.setScalar(fitScale * config.scale);

  brainGroup.position.set(
    containerSize.x * config.offsetX,
    containerSize.y * config.offsetY,
    containerSize.z * config.offsetZ,
  );
}

function updateAllPlacements() {
  updateRobotPlacement();
  updateContainerPlacement();
  updateBrainPlacement();
}

// ========================================
// GREEN AREA LIGHT FOLLOW
// ========================================

const robotWorldBox = new THREE.Box3();
const robotWorldCenter = new THREE.Vector3();
const robotWorldSize = new THREE.Vector3();
const greenLightTarget = new THREE.Vector3();

function updateGreenAreaLight() {
  if (!robotLoaded || !models.robot) return;

  const config = CONFIG.greenAreaLight;

  greenAreaLight.visible = config.enabled;

  if (!config.enabled) return;

  robotGroup.updateWorldMatrix(true, true);

  robotWorldBox.setFromObject(models.robot);

  if (robotWorldBox.isEmpty()) return;

  robotWorldBox.getCenter(robotWorldCenter);
  robotWorldBox.getSize(robotWorldSize);

  const width = Math.max(robotWorldSize.x, 0.1);
  const height = Math.max(robotWorldSize.y, 0.1);
  const depth = Math.max(robotWorldSize.z, 0.1);

  greenAreaLight.width = width * config.widthRatio;

  greenAreaLight.height = height * config.heightRatio;

  greenAreaLight.position.set(
    robotWorldCenter.x + width * config.offsetX,
    robotWorldCenter.y + height * config.offsetY,
    robotWorldCenter.z + depth * config.offsetZ,
  );

  greenLightTarget.copy(robotWorldCenter);

  greenLightTarget.y += height * config.targetY;

  greenAreaLight.lookAt(greenLightTarget);

  greenAreaLight.updateMatrixWorld();
}

// ========================================
// RED LIGHT FOLLOW
// ========================================

function updateRobotLight() {
  if (!robotLoaded) return;

  robotLightAnchor.position.copy(robotGroup.position);

  robotLightAnchor.quaternion.copy(robotGroup.quaternion);

  robotLightAnchor.scale.copy(robotGroup.scale);
}

// ========================================
// RESIZE
// ========================================

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  resizeRenderSurface(renderer, width, height);

  updateAllPlacements();
}

window.addEventListener("resize", resize);
resize();

// ========================================
// GLB LOADER
// ========================================

async function loadModel(name) {
  const path = `${CONFIG.modelPath}${name}.glb`;

  if (CONFIG.debug) {
    console.log("[GLB] Loading:", path);
  }

  const gltf = await loader.loadAsync(path);
  const model = gltf.scene;

  model.name = name;

  setupMaterials(model);
  model.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;
  });

  const size = centerModel(model);

  modelSizes[name] = size;

  if (name === "robot") {
    robotGroup.add(model);
    setupEyeLights(model);
    initRobotAnimation(gltf);
  } else if (name === "container") {
    setupBrainRimLight(model);
    containerGroup.add(model);
  } else if (name === "brain") {
    brainGroup.add(model);
  } else if (name === "background") {
    backgroundGroup.add(model);
    addRoomLights(model);
  } else {
    scene.add(model);
  }

  models[name] = model;

  if (name === "robot") {
    robotLoaded = true;
  }

  if (name !== "robot" && gltf.animations.length > 0) {
    const mixer = new THREE.AnimationMixer(model);

    mixers[name] = mixer;
    actions[name] = {};

    for (const clip of gltf.animations) {
      actions[name][clip.name] = mixer.clipAction(clip);

      if (CONFIG.debug) {
        console.log("[Animation]", name, clip.name);
      }
    }
  }

  updateAllPlacements();

  if (CONFIG.debug) {
    console.log("[GLB] Loaded:", name);
    console.log("[GLB] Size:", size);
  }

  return model;
}

// ========================================
// LOAD MODELS
// ========================================

async function loadAllModels() {
  if (loadStatus) {
    loadStatus.textContent = "Loading 3D models...";
  }

  const results = await Promise.allSettled(CONFIG.models.map(loadModel));

  const failed = results.filter((result) => result.status === "rejected");

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        "[GLB] Loading failed:",
        CONFIG.models[index],
        result.reason,
      );
    }
  });

  updateAllPlacements();

  if (loadStatus) {
    loadStatus.textContent = failed.length
      ? `${failed.length} model(s) failed to load.`
      : "Models ready.";
  }

  if (CONFIG.debug) {
    console.log("[Scene] Loaded models:", Object.keys(models));
  }
}

// ========================================
// ROBOT MOTION
// ========================================

function updateRobotMotion(time, reaction, delta) {
  if (!robotLoaded) return;

  const motion = reducedMotion ? 0 : 1;

  let angle = 0;

  if (reaction === "wrong") {
    angle = Math.sin(time * 5) * 0.09;
  } else if (reaction === "angry" || reaction === "timeout") {
    angle = Math.sin(time * 17) * 0.025;
  } else {
    angle = Math.sin(time * 0.7) * 0.008;
  }

  robotGroup.rotation.z = angle * motion;

  robotTargetPosition.copy(robotBasePosition);

  const screen = getScreenSize();

  if (reaction === "away") {
    robotTargetPosition.x -= screen.width * CONFIG.awayDistance;
  }

  if (reaction === "discarded") {
    robotTargetPosition.y -= screen.height * CONFIG.discardDistance;
  }

  const smoothing = reducedMotion
    ? 1
    : 1 - Math.exp(-CONFIG.motionSpeed * delta);

  robotGroup.position.lerp(robotTargetPosition, smoothing);
  robotGroup.scale.setScalar(THREE.MathUtils.lerp(
    robotGroup.scale.x, robotBaseScale * emphasisScale("robot"), smoothing,
  ));
}

// ========================================
// BRAIN MOTION
// ========================================

let brainFloat = 0;
let brainTension = 0;
let brainShake = 0;

function updateBrainMotion(time, reaction, delta) {
  if (!models.brain || !models.container) return;

  const config = CONFIG.brainInside;
  const size = modelSizes.container;

  const answering = document.body.dataset.phase === "answering";
  const waiting = answering && reaction === "idle";
  const impatient = answering && reaction === "angry";
  const wrong = reaction === "wrong";
  // 平滑調整振幅，讓浮動、緊張與受驚之間的動作自然接續。
  brainFloat = reducedMotion ? 0 : THREE.MathUtils.damp(brainFloat, Number(waiting), 4, delta);
  brainTension = reducedMotion ? 0 : THREE.MathUtils.damp(brainTension, Number(impatient), 8, delta);
  brainShake = reducedMotion ? 0 : THREE.MathUtils.damp(brainShake, Number(wrong), 14, delta);

  const floatOffset = brainFloat * (0.036 + Math.sin(time * 3.2) * 0.012);
  const tenseOffset = brainTension * Math.sin(time * 32) * 0.009;
  const shakeX = brainShake * Math.sin(time * 42) * 0.042;
  const shakeY = brainShake * Math.sin(time * 31) * 0.025;

  brainGroup.position.x = (config.offsetX + tenseOffset + shakeX) * size.x;
  brainGroup.position.y = (config.offsetY + floatOffset + shakeY) * size.y;
  brainGroup.rotation.z = brainShake * Math.sin(time * 37) * 0.16;
  const smoothing = reducedMotion ? 1 : 1 - Math.exp(-CONFIG.motionSpeed * delta);
  containerController.scale.setScalar(THREE.MathUtils.lerp(
    containerController.scale.x, containerBaseScale * emphasisScale("container"), smoothing,
  ));
}

// ========================================
// MAIN RENDER LOOP
// ========================================

const clock = new THREE.Clock();
let elapsedTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  elapsedTime += delta;

  const reaction = window.robotReaction || "idle";

  updateRobotMotion(elapsedTime, reaction, delta);

  updateBrainMotion(elapsedTime, reaction, delta);
  if (brainRimLight) {
    // 面光源的寬高使用世界單位，跟隨容器在答題時的縮放。
    const scale = containerController.scale.x;
    brainRimLight.width = brainRimLightSize.x * scale;
    brainRimLight.height = brainRimLightSize.z * scale;
  }

  if (!reducedMotion) {
  updateRobotAnimation(delta);

  for (const mixer of Object.values(mixers)) {
    mixer.update(delta);
  }
}
  updateRobotLight();
  updateGreenAreaLight();

  const pulse = updateLighting(reaction, elapsedTime, delta, reducedMotion);
  updateEyeGlow(models.robot, reaction, pulse);

  renderer.render(scene, camera);
}

// ========================================
// DEBUG UTILITIES
// ========================================

window.debugScene = {
  scene,
  camera,
  renderer,
  models,
  mixers,
  actions,
  lights,
  backgroundGroup,
  updateBackgroundPlacement,

  robotGroup,
  robotLightAnchor,

  containerController,
  containerGroup,
  brainGroup,

  greenAreaLight,

  modelSizes,

  updateRobotPlacement,
  updateContainerPlacement,
  updateBrainPlacement,
  updateAllPlacements,
  updateGreenAreaLight,
};

// ========================================
// START
// ========================================

loadAllModels();
animate();

console.log("[Scene] Three.js initialized.");
