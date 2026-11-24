
"use strict";

import * as THREE from "three";

// ========================================
// CONFIG
// ========================================

const CONFIG = {
  leftEye: "L_eyeRid",
  rightEye: "L_eyeRid001",

  blinkDuration: 0.36,
  blinkCount: 2,
  expressionDuration: 0.24,
};

const LEGACY_CLIPS = {
  idle: "Idle",
  angry: "Angry",
  away: "WalkAway",
  sold: "Happy",
  discarded: "Discarded",
};

// ========================================
// STATE
// ========================================

let mixer = null;
let currentReaction = "idle";
let expressionElapsed = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const morphKeys = ["blink", "sus", "angry"];
const eyeWeights = { left: [1, 0, 0], right: [1, 0, 0] };
let transitionFrom;

const eyeMeshes = {
  left: null,
  right: null,
};

const clips = new Map();

// ========================================
// SHAPE KEY CONTROL
// ========================================

function applyExpression() {
  const blend = THREE.MathUtils.smoothstep(
    expressionElapsed, 0, CONFIG.expressionDuration,
  );
  const blinkElapsed = Math.max(0, expressionElapsed - CONFIG.expressionDuration);
  const blinkTime = CONFIG.blinkDuration * CONFIG.blinkCount;
  let blink = 1;
  if (currentReaction === "correct" && !reducedMotion.matches && blinkElapsed < blinkTime) {
    const phase = (blinkElapsed % CONFIG.blinkDuration) / CONFIG.blinkDuration;
    blink = 1 - Math.sin(Math.PI * phase) ** 2;
  }

  const normal = [blink, 0, 0];
  let left = normal;
  let right = normal;
  if (currentReaction === "timeout") {
    left = [0, 0, 0.75];
    right = [0, 1, 0];
  } else if (currentReaction === "wrong") {
    left = right = [0, 0, 1];
  }

  for (const [side, target] of [["left", left], ["right", right]]) {
    const mesh = eyeMeshes[side];
    for (let i = 0; i < morphKeys.length; i++) {
      const weight = THREE.MathUtils.lerp(transitionFrom[side][i], target[i], blend);
      eyeWeights[side][i] = weight;
      const index = mesh?.morphTargetDictionary[morphKeys[i]];
      if (index !== undefined) mesh.morphTargetInfluences[index] = weight;
    }
  }
}

// ========================================
// GLB ANIMATION
// ========================================

function playAnimation(name, loop = false) {
  if (!mixer) return;

  const clip = [...clips.values()].find(
    (item) =>
      item.name.toLowerCase() ===
      name.toLowerCase()
  );

  if (!clip) {
    console.warn(
      `[Animation] 找不到動作：${name}`
    );
    return;
  }

  const action = mixer.clipAction(clip);

  action.reset();

  action.setLoop(
    loop ? THREE.LoopRepeat : THREE.LoopOnce,
    loop ? Infinity : 1
  );

  action.clampWhenFinished = !loop;

  action.play();
}

// ========================================
// REACTION EVENTS
// ========================================

export function reactRobot(kind = "idle", immediate = false) {
  currentReaction = kind;
  // 即使中途切換表情，也從上一幀已顯示的權重接續。
  transitionFrom = { left: [...eyeWeights.left], right: [...eyeWeights.right] };
  expressionElapsed = immediate || reducedMotion.matches ? CONFIG.expressionDuration : 0;

  if (mixer) {
    mixer.stopAllAction();

    if (kind === "timeout") {
      playAnimation("knock");
    }

    else if (kind === "wrong") {
      playAnimation("sus");
    }

    else if (LEGACY_CLIPS[kind]) {
      const loop =
        kind === "idle" || kind === "angry";

      const clipName = LEGACY_CLIPS[kind];

      // 舊動作不存在時不需要警告
      const exists = [...clips.keys()].some(
        (name) =>
          name.toLowerCase() ===
          clipName.toLowerCase()
      );

      if (exists) {
        playAnimation(clipName, loop);
      }
    }
  }

  applyExpression();
}

// ========================================
// INITIALIZE GLB
// ========================================

export function initRobotAnimation(gltf) {
  if (!gltf?.scene) {
    throw new Error("GLB 尚未載入");
  }

  if (mixer) {
    mixer.stopAllAction();
  }

  mixer = new THREE.AnimationMixer(gltf.scene);

  clips.clear();
  eyeMeshes.left = null;
  eyeMeshes.right = null;

  // Register animation clips
  for (const clip of gltf.animations ?? []) {
    clips.set(clip.name, clip);
  }

  // Find actual eyelid meshes
  gltf.scene.traverse((object) => {
    if (!object.morphTargetDictionary) return;

    if (object.name === CONFIG.leftEye) {
      eyeMeshes.left = object;
    }

    if (object.name === CONFIG.rightEye) {
      eyeMeshes.right = object;
    }
  });

  console.log(
    "[Animation] Clips:",
    [...clips.keys()]
  );

  console.log(
    "[Morph] Left:",
    eyeMeshes.left?.name,
    eyeMeshes.left?.morphTargetDictionary
  );

  console.log(
    "[Morph] Right:",
    eyeMeshes.right?.name,
    eyeMeshes.right?.morphTargetDictionary
  );

  if (!eyeMeshes.left || !eyeMeshes.right) {
    console.error(
      "[Morph] 找不到左右眼皮 Mesh"
    );
  }

  // Restore current game state
  reactRobot(currentReaction, true);
}

// ========================================
// UPDATE
// ========================================

export function updateRobotAnimation(deltaSeconds) {
  if (!mixer) return;

  const delta = Number.isFinite(deltaSeconds)
    ? Math.max(0, deltaSeconds)
    : 0;

  // Update GLB animation first
  mixer.update(delta);

  expressionElapsed = Math.min(
    expressionElapsed + delta,
    CONFIG.expressionDuration + CONFIG.blinkDuration * CONFIG.blinkCount,
  );

  // Apply Shape Keys AFTER mixer update
  // 防止 GLB 動畫覆蓋表情設定
  applyExpression();
}

// ========================================
// LISTEN TO GAME.JS
// ========================================

window.addEventListener(
  "robot:reaction",
  (event) => {
    const kind =
      event.detail?.kind ?? "idle";

    reactRobot(kind);
  }
);
