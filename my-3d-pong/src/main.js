// main.js
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createUI, updateScore, updateRally, showServeIndicator } from './ui.js';
import { Controls } from './controls.js';
import { PhysicsEngine } from './physics.js';
import { OpponentAI } from './ai.js';

// Scene + Renderer
const scene = new THREE.Scene();

// Gradient background texture
const canvasBG = document.createElement('canvas');
canvasBG.width = 1;
canvasBG.height = 256;
const ctx = canvasBG.getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 256);
gradient.addColorStop(0, '#273544');
gradient.addColorStop(1, '#101216');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1, 256);
const bgTexture = new THREE.CanvasTexture(canvasBG);
scene.background = bgTexture;
scene.fog = new THREE.Fog(0x0e1116, 20, 120);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 6, 12.5);
camera.lookAt(0, 2.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const gameContainer = document.getElementById('game-container');
gameContainer.appendChild(renderer.domElement);

// Environment
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

// Lights + volumetric cones
scene.add(new THREE.HemisphereLight(0xc7d4ff, 0x3a0c13, 0.25));
scene.add(new THREE.AmbientLight(0xffffff, 0.2));

const keySpot = new THREE.SpotLight(0xffffff, 18, 48, Math.PI * 0.18, 0.35);
keySpot.position.set(0, 20, 6);
keySpot.castShadow = true;
keySpot.shadow.mapSize.set(3072, 3072);
keySpot.shadow.bias = -0.00025;
scene.add(keySpot);

const rimL = new THREE.SpotLight(0xffffff, 9, 50, Math.PI * 0.22, 0.45);
rimL.position.set(-14, 10, -2);
rimL.castShadow = true;
rimL.shadow.bias = -0.00025;
scene.add(rimL);

const rimR = new THREE.SpotLight(0xffffff, 9, 50, Math.PI * 0.22, 0.45);
rimR.position.set(14, 10, 2);
rimR.castShadow = true;
rimR.shadow.bias = -0.00025;
scene.add(rimR);

function createLightBeam(color, position) {
  const coneGeo = new THREE.ConeGeometry(3, 8, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.copy(position);
  cone.rotation.x = -Math.PI / 2;
  scene.add(cone);
  return cone;
}
createLightBeam(0xffffff, new THREE.Vector3(0, 18, 6));
createLightBeam(0xa0c4ff, new THREE.Vector3(-14, 10, -2));
createLightBeam(0xa0c4ff, new THREE.Vector3(14, 10, 2));

// Arena walls and ceiling
const arenaW = 92;
const arenaL = 120;
const arenaH = 24;

function createWallTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#12171e';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 10000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const wallTexture = createWallTexture();

const wallMat = new THREE.MeshStandardMaterial({
  color: 0x12171e,
  roughness: 0.85,
  metalness: 0.05,
  map: wallTexture,
});

const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaH), wallMat);
wallFront.position.set(0, arenaH / 2, arenaL / 2);
wallFront.rotation.y = Math.PI;
scene.add(wallFront);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaL), wallMat);
ceiling.position.set(0, arenaH, 0);
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);

// Emissive ceiling strips
const panelMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0x303030),
  emissiveIntensity: 1.8,
  roughness: 0.7,
  metalness: 0.0,
});
for (let i = -2; i <= 2; i++) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), panelMat);
  strip.position.set(i * 12, arenaH - 0.05, (i % 2 === 0 ? 3 : -3));
  strip.rotation.x = Math.PI / 2;
  scene.add(strip);
}

// Sports mat floor texture
function makeSportsMatMaps(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const r = document.createElement('canvas');
  r.width = r.height = size;

  const ctx = c.getContext('2d');
  const rtx = r.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#b11631');
  grad.addColorStop(1, '#6f0d23');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = 0.02 + Math.random() * 0.04;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1.1;
  const step = size / 20;
  for (let y = 0; y < size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 2 - 1);
    ctx.lineTo(size, y + Math.random() * 2 - 1);
    ctx.stroke();
  }
  for (let x = 0; x < size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + Math.random() * 2 - 1, 0);
    ctx.lineTo(x + Math.random() * 2 - 1, size);
    ctx.stroke();
  }

  rtx.fillStyle = '#c9c9c9';
  rtx.fillRect(0, 0, size, size);
  rtx.globalAlpha = 0.3;
  rtx.drawImage(c, 0, 0);
  rtx.globalAlpha = 1.0;

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const rough = new THREE.CanvasTexture(r);
  rough.wrapS = THREE.RepeatWrapping;
  rough.wrapT = THREE.RepeatWrapping;

  return { map, rough };
}

const { map: sportsMatMap, rough: sportsMatRough } = makeSportsMatMaps(1024);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
sportsMatMap.anisotropy = maxAniso;
sportsMatRough.anisotropy = maxAniso;
sportsMatMap.repeat.set(14, 14);
sportsMatRough.repeat.set(14, 14);

const floorGeom = new THREE.PlaneGeometry(84, 84);
const floorMat = new THREE.MeshStandardMaterial({
  map: sportsMatMap,
  roughnessMap: sportsMatRough,
  roughness: 0.95,
  metalness: 0.02,
});
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// Dust particles
const particleCount = 300;
const particlesGeo = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = (Math.random() - 0.5) * arenaW * 0.8;
  positions[i * 3 + 1] = Math.random() * arenaH * 0.8 + 1;
  positions[i * 3 + 2] = (Math.random() - 0.5) * arenaL * 0.8;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particlesMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.1,
  transparent: true,
  opacity: 0.05,
});
const particles = new THREE.Points(particlesGeo, particlesMat);
scene.add(particles);

// Constants & Materials
const TABLE_LENGTH = 9.0;
const TABLE_WIDTH = 5.0;
const TABLE_THICKNESS = 0.25;
const TABLE_TOP_Y = 2.5;
const NET_HEIGHT = 0.5;
const NET_OVERHANG = 0.5;
const BOUNDARY_LINE_THICK = 0.066;
const CENTER_LINE_THICK = 0.01;
const BALL_RADIUS = 0.066;
const UNITS_PER_M = TABLE_LENGTH / 2.74;

const tableMaterial = new THREE.MeshStandardMaterial({
  color: 0x0e3a8a,
  roughness: 0.72,
  metalness: 0.0,
});
const lineMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.65,
  metalness: 0.0,
});
const frameMetal = new THREE.MeshStandardMaterial({
  color: 0x8a8d92,
  roughness: 0.28,
  metalness: 0.85,
});
const paddleRedMaterial = new THREE.MeshStandardMaterial({
  color: 0xaa1a1a,
  roughness: 0.8,
  metalness: 0.0,
});
const paddleBlackMaterial = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 0.8,
  metalness: 0.0,
});
const ballMaterial = new THREE.MeshStandardMaterial({
  color: 0xf5f5f5,
  roughness: 0.75,
  metalness: 0.0,
});
const tapeMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.6,
  metalness: 0.0,
});

// Table builder
function buildTable() {
  const g = new THREE.Group();
  g.position.y = TABLE_TOP_Y - TABLE_THICKNESS / 2;

  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICKNESS, TABLE_LENGTH),
    tableMaterial,
  );
  tableTop.receiveShadow = true;
  g.add(tableTop);

  const endLineGeom = new THREE.BoxGeometry(TABLE_WIDTH, 0.01, BOUNDARY_LINE_THICK);
  const endNear = new THREE.Mesh(endLineGeom, lineMaterial);
  endNear.position.set(0, TABLE_THICKNESS / 2 + 0.006, -TABLE_LENGTH / 2);
  g.add(endNear);

  const endFar = endNear.clone();
  endFar.position.z = TABLE_LENGTH / 2;
  g.add(endFar);

  const sideLineGeom = new THREE.BoxGeometry(BOUNDARY_LINE_THICK, 0.01, TABLE_LENGTH);
  const sideL = new THREE.Mesh(sideLineGeom, lineMaterial);
  sideL.position.set(-TABLE_WIDTH / 2, TABLE_THICKNESS / 2 + 0.006, 0);
  g.add(sideL);

  const sideR = sideL.clone();
  sideR.position.x = TABLE_WIDTH / 2;
  g.add(sideR);

  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(CENTER_LINE_THICK, 0.01, TABLE_LENGTH),
    lineMaterial,
  );
  centerLine.position.set(0, TABLE_THICKNESS / 2 + 0.006, 0);
  g.add(centerLine);

  const legGeom = new THREE.BoxGeometry(0.15, TABLE_TOP_Y - 0.05, 0.15);
  const addLeg = (x, z) => {
    const leg = new THREE.Mesh(legGeom, frameMetal);
    leg.position.set(x, -((TABLE_TOP_Y - 0.05) / 2), z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    g.add(leg);
  };
  const legX = TABLE_WIDTH / 2 - 0.35;
  const legZ = TABLE_LENGTH / 2 - 0.4;
  addLeg(legX, legZ);
  addLeg(-legX, legZ);
  addLeg(legX, -legZ);
  addLeg(-legX, -legZ);

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_WIDTH - 0.8, 0.08, 0.08),
    frameMetal,
  );
  bar.position.set(0, -0.8, 0);
  bar.castShadow = true;
  bar.receiveShadow = true;
  g.add(bar);

  return g;
}
const mainTable = buildTable();
scene.add(mainTable);

// Net (shader material)
const netWidth = TABLE_WIDTH + NET_OVERHANG * 2;
const netHeight = NET_HEIGHT;
const cellMeters = 0.015;
const uCell = cellMeters * UNITS_PER_M;

const netUniforms = {
  uColor: { value: new THREE.Color(0xE6E6E6) },
  uBackColor: { value: new THREE.Color(0x0a0a0a) },
  uCell: { value: uCell },
  uHalf: { value: new THREE.Vector2(netWidth * 0.5, netHeight * 0.5) },
  uOpacity: { value: 0.96 },
  uSag: { value: 0.055 },
};

const netMat = new THREE.ShaderMaterial({
  uniforms: netUniforms,
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: `
    varying vec3 vPos;
    uniform float uSag;
    uniform vec2 uHalf;
    void main() {
      vec3 p = position;
      vPos = p;
      float xNorm = clamp(p.x / uHalf.x, -1.0, 1.0);
      float sag = uSag * (1.0 - xNorm * xNorm);
      p.y -= sag;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    uniform vec3 uColor;
    uniform vec3 uBackColor;
    uniform float uCell;
    uniform float uOpacity;
    uniform vec2 uHalf;

    float lineFactor(float d, float w){
      return step(d, w);
    }

    void main() {
      vec2 g = vec2(vPos.x + uHalf.x, vPos.y + uHalf.y) / uCell;
      vec2 f = abs(fract(g) - 0.5);
      float lw = 0.12;
      float gx = lineFactor(f.x, lw);
      float gy = lineFactor(f.y, lw);
      float isLine = clamp(gx + gy, 0.0, 1.0);

      vec3 col = mix(uBackColor, uColor, isLine);
      float alpha = mix(0.0, uOpacity, isLine);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const netGeom = new THREE.PlaneGeometry(netWidth, netHeight, 128, 32);
const net = new THREE.Mesh(netGeom, netMat);
net.position.set(0, TABLE_TOP_Y + netHeight / 2, 0);
scene.add(net);

const cord = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, netWidth, 20),
  frameMetal,
);
cord.rotation.z = Math.PI / 2;
cord.position.set(0, TABLE_TOP_Y + netHeight + 0.02, 0.01);
scene.add(cord);

const tape = new THREE.Mesh(
  new THREE.BoxGeometry(netWidth, 0.05, 0.02),
  tapeMaterial,
);
tape.position.set(0, TABLE_TOP_Y + netHeight + 0.05, 0.01);
scene.add(tape);

const postGeom = new THREE.CylinderGeometry(0.055, 0.055, netHeight + 0.28, 24);
const postL = new THREE.Mesh(postGeom, frameMetal);
postL.position.set(-TABLE_WIDTH / 2 - NET_OVERHANG, TABLE_TOP_Y + (netHeight + 0.28) / 2, 0);
postL.castShadow = true;
scene.add(postL);

const postR = postL.clone();
postR.position.x = TABLE_WIDTH / 2 + NET_OVERHANG;
scene.add(postR);

// Advertising barriers
const barrierW = 2.33 * UNITS_PER_M;
const barrierH = 0.72 * UNITS_PER_M;

function makeBannerTexture(text = 'ACR TABLE', w = 2048, h = 512) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0B3C91';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#0d2852';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 200px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const bannerTex = makeBannerTexture('ACR TABLE', 2048, 512);
bannerTex.anisotropy = maxAniso;

function makeBarrier() {
  const group = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    roughness: 0.6,
    metalness: 0.0,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(barrierW, barrierH), clothMat);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(barrierW, 0.02, 0.02), frameMetal);
  frame.position.y = barrierH / 2;
  const footGeom = new THREE.BoxGeometry(0.05, 0.02, 0.35);
  const footL = new THREE.Mesh(footGeom, frameMetal);
  footL.position.set(-barrierW / 2 + 0.2, 0.01, 0.15);
  const footR = footL.clone();
  footR.position.x = barrierW / 2 - 0.2;
  group.add(panel, frame, footL, footR);
  return group;
}

const barrierGroup = new THREE.Group();
const marginZ = 3.2;
const marginX = 3.2;

const runFront = Math.ceil((TABLE_WIDTH + marginX * 2) / barrierW);
for (let i = 0; i < runFront; i++) {
  const x = -((runFront - 1) * barrierW) / 2 + i * barrierW;

  const bFront = makeBarrier();
  bFront.position.set(x, barrierH / 2, TABLE_LENGTH / 2 + marginZ);
  barrierGroup.add(bFront);

  const bBack = makeBarrier();
  bBack.position.set(x, barrierH / 2, -TABLE_LENGTH / 2 - marginZ);
  bBack.rotation.y = Math.PI;
  barrierGroup.add(bBack);
}

const runSides = Math.ceil((TABLE_LENGTH + marginZ * 2) / barrierW);
for (let i = 0; i < runSides; i++) {
  const z = -((runSides - 1) * barrierW) / 2 + i * barrierW;

  const bLeft = makeBarrier();
  bLeft.position.set(-TABLE_WIDTH / 2 - marginX, barrierH / 2, z);
  bLeft.rotation.y = Math.PI / 2;
  barrierGroup.add(bLeft);

  const bRight = makeBarrier();
  bRight.position.set(TABLE_WIDTH / 2 + marginX, barrierH / 2, z);
  bRight.rotation.y = -Math.PI / 2;
  barrierGroup.add(bRight);
}

scene.add(barrierGroup);

// Extra side tables
function spawnEmptyTable(x, z) {
  const t = buildTable();
  t.position.x = x;
  t.position.z = z;
  scene.add(t);
}

const sideOffsetX = TABLE_WIDTH / 2 + marginX + 6.0;
spawnEmptyTable(-sideOffsetX, -4.5);
spawnEmptyTable(-sideOffsetX, 4.5);
spawnEmptyTable(sideOffsetX, -4.5);
spawnEmptyTable(sideOffsetX, 4.5);

// Premium wood texture for walls
function createPremiumWoodTexture(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#5d3a1a');
  grad.addColorStop(0.5, '#824d1a');
  grad.addColorStop(1, '#4c2a0e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const plankHeight = 150;
  const plankCount = Math.ceil(height / plankHeight) + 1;

  const drawGrainLines = (xStart, yStart, w, h) => {
    const lines = 50;
    for (let i = 0; i < lines; i++) {
      const x = xStart + Math.random() * w;
      const y = yStart + Math.random() * h;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(80, 50, 20, ${0.15 + Math.random() * 0.1})`;
      ctx.lineWidth = 1;
      const cp1x = x + (Math.random() - 0.5) * 20;
      const cp1y = y + (Math.random() - 0.5) * 10;
      const cp2x = x + (Math.random() - 0.5) * 20;
      const cp2y = y + h / 2 + (Math.random() - 0.5) * 10;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x + 10, y + h);
      ctx.stroke();
    }
  };

  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(100, 60, 20, 0.8)';

  for (let i = 0; i < plankCount; i++) {
    let y = i * plankHeight;
    let offset = (i % 2) * width * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < width; x += 20) {
      ctx.lineTo(x, y + Math.sin((x + offset) * 0.04) * 3);
    }
    ctx.stroke();
    drawGrainLines(0, y, width, plankHeight);
  }

  const noiseDensity = 90000;
  for (let i = 0; i < noiseDensity; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = Math.random() * 0.06;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const woodTexture = createPremiumWoodTexture();
const woodMaterial = new THREE.MeshStandardMaterial({
  map: woodTexture,
  roughness: 0.48,
  metalness: 0.12,
  envMapIntensity: 0.3,
  color: 0xffffff,
});

const backWoodWall = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaH), woodMaterial);
backWoodWall.position.set(0, arenaH / 2, -arenaL / 2);
scene.add(backWoodWall);

const leftWoodWall = new THREE.Mesh(new THREE.PlaneGeometry(arenaL, arenaH), woodMaterial);
leftWoodWall.rotation.y = Math.PI / 2;
leftWoodWall.position.set(-arenaW / 2, arenaH / 2, 0);
scene.add(leftWoodWall);

const rightWoodWall = leftWoodWall.clone();
rightWoodWall.rotation.y = -Math.PI / 2;
rightWoodWall.position.x = arenaW / 2;
scene.add(rightWoodWall);

// Paddles
const PADDLE_RADIUS = 0.45;
const PADDLE_DEPTH = 0.12;

function makeCircularPaddle(material) {
  const group = new THREE.Group();

  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, PADDLE_DEPTH, 48),
    material,
  );
  blade.rotation.x = Math.PI / 2;
  blade.castShadow = true;
  blade.receiveShadow = true;
  group.add(blade);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.6, 24),
    frameMetal,
  );
  handle.position.set(0, -0.55, 0);
  handle.castShadow = true;
  handle.receiveShadow = true;
  group.add(handle);

  return group;
}

const playerPaddle = makeCircularPaddle(paddleRedMaterial);
playerPaddle.position.set(0, TABLE_TOP_Y + 0.35, TABLE_LENGTH / 2 + 1.0);
scene.add(playerPaddle);

const opponentPaddle = makeCircularPaddle(paddleBlackMaterial);
opponentPaddle.position.set(0, TABLE_TOP_Y + 0.35, -TABLE_LENGTH / 2 - 1.0);
scene.add(opponentPaddle);

// Ball
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
  ballMaterial,
);
ball.castShadow = true;
scene.add(ball);

// Game objects
const ui = createUI(gameContainer);
const controls = new Controls(camera, playerPaddle, ball, TABLE_WIDTH, TABLE_TOP_Y, PADDLE_RADIUS);
const physics = new PhysicsEngine(ball, mainTable, net, playerPaddle, opponentPaddle, TABLE_WIDTH, TABLE_LENGTH, TABLE_TOP_Y, NET_HEIGHT, BALL_RADIUS, ui, controls);
const ai = new OpponentAI(opponentPaddle, ball, TABLE_WIDTH, TABLE_LENGTH, TABLE_TOP_Y, physics);

// Start button listener
ui.startButton.addEventListener('click', () => {
  controls.startGame(physics);
});

// Event listeners
window.addEventListener('mousemove', (event) => controls.handleMouseMove(event));
window.addEventListener('mousedown', () => controls.handleMouseDown(physics));
window.addEventListener('touchmove', (event) => controls.handleTouchMove(event), { passive: false });
window.addEventListener('touchstart', (event) => controls.handleTouchStart(event, physics), { passive: false });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);

  // Update particles
  const posArr = particlesGeo.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    posArr[i * 3 + 1] += delta * 0.03;
    posArr[i * 3] += Math.sin(clock.elapsedTime + i) * 0.001;
    if (posArr[i * 3 + 1] > arenaH) {
      posArr[i * 3 + 1] = 0.5 + Math.random() * arenaH * 0.3;
    }
  }
  particlesGeo.attributes.position.needsUpdate = true;

  // Update opponent AI
  ai.update(delta, physics);

  // Update physics
  physics.update(delta, ai);

  // Update controls
  controls.updatePaddleVelocity(delta);

  renderer.render(scene, camera);
}

animate();