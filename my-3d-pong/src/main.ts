import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';

/**
 * Scene + Renderer
 */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101216);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 5.5, 12);
camera.lookAt(0, 2.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
(document as any).renderer = renderer; // for debugging

const gameContainer = document.getElementById('game-container') as HTMLElement;
gameContainer.appendChild(renderer.domElement);

/**
 * Environment/PBR baseline (no bloom)
 */
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const keySpot = new THREE.SpotLight(0xffffff, 18, 40, Math.PI * 0.18, 0.35);
keySpot.position.set(0, 15, 5);
keySpot.castShadow = true;
keySpot.shadow.mapSize.set(2048, 2048);
keySpot.shadow.bias = -0.00025;
scene.add(keySpot);

const rimL = new THREE.SpotLight(0xffffff, 8, 40, Math.PI * 0.22, 0.45);
rimL.position.set(-12, 9, -2);
rimL.castShadow = true;
rimL.shadow.bias = -0.00025;
scene.add(rimL);

const rimR = new THREE.SpotLight(0xffffff, 8, 40, Math.PI * 0.22, 0.45);
rimR.position.set(12, 9, 2);
rimR.castShadow = true;
rimR.shadow.bias = -0.00025;
scene.add(rimR);

/**
 * Arena envelope (walls/ceiling + subtle emissive panels)
 */
const roomGroup = new THREE.Group();
const roomMat = new THREE.MeshStandardMaterial({
  color: 0x0e1116,
  roughness: 0.9,
  metalness: 0.0,
});

const arenaW = 80;
const arenaL = 90;
const arenaH = 20;

const floorY = 0;

const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaH), roomMat);
wallBack.position.set(0, arenaH / 2, -arenaL / 2);
scene.add(wallBack);

const wallFront = wallBack.clone();
wallFront.position.z = arenaL / 2;
wallFront.rotation.y = Math.PI;
scene.add(wallFront);

const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(arenaL, arenaH), roomMat);
wallLeft.rotation.y = Math.PI / 2;
wallLeft.position.set(-arenaW / 2, arenaH / 2, 0);
scene.add(wallLeft);

const wallRight = wallLeft.clone();
wallRight.position.x = arenaW / 2;
wallRight.rotation.y = -Math.PI / 2;
scene.add(wallRight);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaL), roomMat);
ceiling.position.set(0, arenaH, 0);
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);

// Emissive ceiling strips (visual only)
const panelMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0x222222),
  emissiveIntensity: 1.4,
  roughness: 0.7,
  metalness: 0.0,
});
for (let i = -2; i <= 2; i += 2) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), panelMat);
  strip.position.set(i * 6, arenaH - 0.05, -2 + (i % 4 === 0 ? 2 : -2));
  strip.rotation.x = Math.PI / 2;
  scene.add(strip);
}

/**
 * Scaling constants (regulation)
 * 2.74m (L) => 9 units, 1.525m (W) => 5 units, top at 0.76m => ~2.5 units
 */
const TABLE_LENGTH = 9.0;
const TABLE_WIDTH = 5.0;
const TABLE_THICKNESS = 0.25;
const TABLE_TOP_Y = 2.5;
const NET_HEIGHT = 0.5;            // 15.25 cm
const NET_OVERHANG = 0.5;          // 15.25 cm each side
const BOUNDARY_LINE_THICK = 0.066; // ~2 cm
const CENTER_LINE_THICK = 0.01;    // ~3 mm
const BALL_RADIUS = 0.066;         // 40mm diameter -> r ~ 0.066

// Scale factor for real meters
const UNITS_PER_M = TABLE_LENGTH / 2.74;

/**
 * Materials
 */
const tableMaterial = new THREE.MeshStandardMaterial({
  color: 0x0e3a8a,
  roughness: 0.75,
  metalness: 0.0,
});
const lineMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.7,
  metalness: 0.0,
});
const frameMetal = new THREE.MeshStandardMaterial({
  color: 0x8a8d92,
  roughness: 0.25,
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

/**
 * Procedural parquet floor (CanvasTexture, no external assets)
 */
function makeParquetTexture(size = 1024, planks = 10) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5a422c';
  ctx.fillRect(0, 0, size, size);

  const plankW = size / planks;
  for (let y = 0; y < planks; y++) {
    for (let x = 0; x < planks; x++) {
      const px = Math.floor(x * plankW);
      const py = Math.floor(y * plankW);
      const w = Math.ceil(plankW);
      const h = Math.ceil(plankW);

      // Vary tone
      const base = 80 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `hsl(30, 30%, ${base}%)`;
      ctx.fillRect(px, py, w, h);

      // Subtle grain lines
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.04})`;
      ctx.lineWidth = 1;
      for (let gy = 0; gy < h; gy += 6 + Math.random() * 8) {
        ctx.beginPath();
        ctx.moveTo(px + 2, py + gy);
        ctx.lineTo(px + w - 2, py + gy + (Math.random() * 2 - 1));
        ctx.stroke();
      }

      // Seams
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, w, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const parquet = makeParquetTexture(1024, 8);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
parquet.anisotropy = maxAniso;
parquet.repeat.set(12, 12);

const floorGeom = new THREE.PlaneGeometry(70, 70);
(floorGeom as any).setAttribute('uv2', new THREE.BufferAttribute(
  (floorGeom.attributes.uv as THREE.BufferAttribute).array, 2,
));

const floorMat = new THREE.MeshStandardMaterial({
  map: parquet,
  roughness: 0.85,
  metalness: 0.02,
});
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = floorY;
floor.receiveShadow = true;
scene.add(floor);

/**
 * Table group
 */
const tableGroup = new THREE.Group();
tableGroup.position.y = TABLE_TOP_Y - TABLE_THICKNESS / 2;

// Tabletop
const tableTop = new THREE.Mesh(
  new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICKNESS, TABLE_LENGTH),
  tableMaterial,
);
tableTop.receiveShadow = true;
tableTop.castShadow = false;
tableGroup.add(tableTop);

// Boundary lines
const endLineGeom = new THREE.BoxGeometry(TABLE_WIDTH, 0.01, BOUNDARY_LINE_THICK);
const endLineNear = new THREE.Mesh(endLineGeom, lineMaterial);
endLineNear.position.set(0, TABLE_THICKNESS / 2 + 0.006, -TABLE_LENGTH / 2);
tableGroup.add(endLineNear);

const endLineFar = endLineNear.clone();
endLineFar.position.z = TABLE_LENGTH / 2;
tableGroup.add(endLineFar);

const sideLineGeom = new THREE.BoxGeometry(BOUNDARY_LINE_THICK, 0.01, TABLE_LENGTH);
const sideLineL = new THREE.Mesh(sideLineGeom, lineMaterial);
sideLineL.position.set(-TABLE_WIDTH / 2, TABLE_THICKNESS / 2 + 0.006, 0);
tableGroup.add(sideLineL);

const sideLineR = sideLineL.clone();
sideLineR.position.x = TABLE_WIDTH / 2;
tableGroup.add(sideLineR);

// Center line (doubles)
const centerLine = new THREE.Mesh(
  new THREE.BoxGeometry(CENTER_LINE_THICK, 0.01, TABLE_LENGTH),
  lineMaterial,
);
centerLine.position.set(0, TABLE_THICKNESS / 2 + 0.006, 0);
tableGroup.add(centerLine);

// Legs and frame
const legGeom = new THREE.BoxGeometry(0.15, TABLE_TOP_Y - 0.05, 0.15);
function addLeg(x: number, z: number) {
  const leg = new THREE.Mesh(legGeom, frameMetal);
  leg.position.set(x, -((TABLE_TOP_Y - 0.05) / 2), z);
  leg.castShadow = true;
  leg.receiveShadow = true;
  tableGroup.add(leg);
}
const legOffsetX = TABLE_WIDTH / 2 - 0.35;
const legOffsetZ = TABLE_LENGTH / 2 - 0.4;
addLeg(legOffsetX, legOffsetZ);
addLeg(-legOffsetX, legOffsetZ);
addLeg(legOffsetX, -legOffsetZ);
addLeg(-legOffsetX, -legOffsetZ);

// Cross bar
const bar = new THREE.Mesh(
  new THREE.BoxGeometry(TABLE_WIDTH - 0.8, 0.08, 0.08),
  frameMetal,
);
bar.position.set(0, -0.8, 0);
bar.castShadow = true;
bar.receiveShadow = true;
tableGroup.add(bar);

scene.add(tableGroup);

/**
 * High-quality net (dense mesh, shader sag), top cord + tape, posts
 * Regulation height 15.25 cm and 15.25 cm overhang each side
 */
const netWidth = TABLE_WIDTH + NET_OVERHANG * 2;
const netHeight = NET_HEIGHT;

// Compute grid density to mimic ~1.5 cm squares
const cellMeters = 0.015;
const cellsX = Math.max(40, Math.floor((netWidth / UNITS_PER_M) / cellMeters));
const cellsY = Math.max(18, Math.floor((netHeight / UNITS_PER_M) / cellMeters));

const netUniforms = {
  uColor: { value: new THREE.Color(0xE6E6E6) },
  uBackColor: { value: new THREE.Color(0x0a0a0a) },
  uScale: { value: new THREE.Vector2(cellsX, cellsY) },
  uLine: { value: 0.16 }, // filament thickness within each cell
  uOpacity: { value: 0.95 },
  uHalfWidth: { value: netWidth * 0.5 },
  uSag: { value: 0.055 }, // sag amount at center
};

const netMat = new THREE.ShaderMaterial({
  uniforms: netUniforms,
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: `
    varying vec2 vUv;
    uniform float uHalfWidth;
    uniform float uSag;
    void main() {
      vUv = uv;
      vec3 p = position;
      float xNorm = clamp(p.x / uHalfWidth, -1.0, 1.0);
      float sag = uSag * (1.0 - xNorm * xNorm);
      p.y -= sag;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform vec3 uBackColor;
    uniform vec2 uScale;
    uniform float uLine;
    uniform float uOpacity;

    void main() {
      vec2 uv = fract(vUv * uScale);
      float lineX = min(uv.x, 1.0 - uv.x);
      float lineY = min(uv.y, 1.0 - uv.y);
      float lineWidth = uLine * 0.5;
      float isLine = step(lineX, lineWidth) + step(lineY, lineWidth);
      isLine = clamp(isLine, 0.0, 1.0);
      vec3 col = mix(uBackColor, uColor, isLine);
      float alpha = mix(0.0, uOpacity, isLine);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const netGeom = new THREE.PlaneGeometry(netWidth, netHeight, 96, 24);
const net = new THREE.Mesh(netGeom, netMat);
net.position.set(0, TABLE_TOP_Y + netHeight / 2, 0);
net.renderOrder = 1;
scene.add(net);

// Top cord and tape
const cord = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, netWidth, 16),
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

// Net posts
const postGeom = new THREE.CylinderGeometry(0.055, 0.055, netHeight + 0.28, 24);
const postL = new THREE.Mesh(postGeom, frameMetal);
postL.position.set(-TABLE_WIDTH / 2 - NET_OVERHANG, TABLE_TOP_Y + (netHeight + 0.28) / 2, 0);
postL.castShadow = true;
scene.add(postL);

const postR = postL.clone();
postR.position.x = TABLE_WIDTH / 2 + NET_OVERHANG;
scene.add(postR);

/**
 * Advertising barriers (“ACR TABLE”) around the court
 * Common size: ~2.33 m × ~0.70–0.73 m => convert to scene units
 */
const barrierW = 2.33 * UNITS_PER_M;
const barrierH = 0.72 * UNITS_PER_M;

function makeBannerTexture(text = 'ACR TABLE', w = 1024, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  // base
  ctx.fillStyle = '#0B3C91';
  ctx.fillRect(0, 0, w, h);
  // border
  ctx.strokeStyle = '#0d2852';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  // text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 140px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
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
  panel.castShadow = false;
  panel.receiveShadow = false;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(barrierW, 0.02, 0.02),
    frameMetal,
  );
  frame.position.y = barrierH / 2;

  // Simple feet
  const footGeom = new THREE.BoxGeometry(0.05, 0.02, 0.35);
  const footL = new THREE.Mesh(footGeom, frameMetal);
  footL.position.set(-barrierW / 2 + 0.2, 0.01, 0.15);
  const footR = footL.clone();
  footR.position.x = barrierW / 2 - 0.2;

  group.add(panel, frame, footL, footR);
  return group;
}

// Place a rectangle of barriers around the table
const barrierGroup = new THREE.Group();
const marginZ = 3.0;
const marginX = 3.0;

const runFront = Math.ceil((TABLE_WIDTH + marginX * 2) / barrierW);
for (let i = 0; i < runFront; i++) {
  const bFront = makeBarrier();
  const x = -((runFront - 1) * barrierW) / 2 + i * barrierW;
  bFront.position.set(x, floorY + barrierH / 2, TABLE_LENGTH / 2 + marginZ);
  barrierGroup.add(bFront);

  const bBack = makeBarrier();
  bBack.position.set(x, floorY + barrierH / 2, -TABLE_LENGTH / 2 - marginZ);
  bBack.rotation.y = Math.PI;
  barrierGroup.add(bBack);
}

const runSides = Math.ceil((TABLE_LENGTH + marginZ * 2) / barrierW);
for (let i = 0; i < runSides; i++) {
  const bLeft = makeBarrier();
  const z = -((runSides - 1) * barrierW) / 2 + i * barrierW;
  bLeft.position.set(-TABLE_WIDTH / 2 - marginX, floorY + barrierH / 2, z);
  bLeft.rotation.y = Math.PI / 2;
  barrierGroup.add(bLeft);

  const bRight = makeBarrier();
  bRight.position.set(TABLE_WIDTH / 2 + marginX, floorY + barrierH / 2, z);
  bRight.rotation.y = -Math.PI / 2;
  barrierGroup.add(bRight);
}

scene.add(barrierGroup);

/**
 * Paddles
 */
const PADDLE_WIDTH = 0.5;
const PADDLE_HEIGHT = 0.6;
const PADDLE_DEPTH = 0.1;

function makePaddle(material: THREE.Material) {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_DEPTH),
    material,
  );
  blade.castShadow = true;
  blade.receiveShadow = true;
  group.add(blade);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.4, 0.14),
    frameMetal,
  );
  handle.position.set(0, -PADDLE_HEIGHT / 2 - 0.2, 0.0);
  handle.castShadow = true;
  handle.receiveShadow = true;
  group.add(handle);
  return group;
}

const playerPaddle = makePaddle(paddleRedMaterial);
playerPaddle.position.set(0, TABLE_TOP_Y + 0.3, TABLE_LENGTH / 2 + 0.9);
scene.add(playerPaddle);

const opponentPaddle = makePaddle(paddleBlackMaterial);
opponentPaddle.position.set(0, TABLE_TOP_Y + 0.3, -TABLE_LENGTH / 2 - 0.9);
scene.add(opponentPaddle);

/**
 * Ball
 */
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
  ballMaterial,
);
ball.castShadow = true;
scene.add(ball);

/**
 * Game logic
 */
let playerScore = 0;
let opponentScore = 0;
let ballVelocity = new THREE.Vector3(0, 0, 0.14);

const playerScoreElem = document.getElementById('player-score')!;
const opponentScoreElem = document.getElementById('opponent-score')!;

function resetBall() {
  ball.position.set(0, TABLE_TOP_Y + BALL_RADIUS + 0.05, 0);
  const serveDir = playerScore >= opponentScore ? -1 : 1;
  ballVelocity.set(
    (Math.random() * 0.08 - 0.04),
    0.10,
    0.14 * serveDir,
  );
}
resetBall();

/**
 * Controls
 */
const gamePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -playerPaddle.position.z);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(gamePlane, intersectPoint);

  const clampX = THREE.MathUtils.clamp(
    intersectPoint.x,
    -TABLE_WIDTH / 2 + PADDLE_WIDTH / 2,
    TABLE_WIDTH / 2 - PADDLE_WIDTH / 2,
  );
  playerPaddle.position.x = clampX;

  const minY = TABLE_TOP_Y + 0.2;
  const maxY = TABLE_TOP_Y + 1.6;
  playerPaddle.position.y = THREE.MathUtils.clamp(intersectPoint.y, minY, maxY);
});

/**
 * Animation + Physics
 */
const clock = new THREE.Clock();
const GRAVITY = 9.8;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Ball physics
  ballVelocity.y -= GRAVITY * delta * 0.20;
  ball.position.addScaledVector(ballVelocity, delta * 15);

  // Opponent AI follows ball X smoothly
  const aiSpeed = 4.0;
  const targetX = THREE.MathUtils.clamp(
    ball.position.x,
    -TABLE_WIDTH / 2 + PADDLE_WIDTH / 2,
    TABLE_WIDTH / 2 - PADDLE_WIDTH / 2,
  );
  opponentPaddle.position.x += (targetX - opponentPaddle.position.x) * aiSpeed * delta;

  // Table bounce
  const tableTopY = TABLE_TOP_Y + 0.0001;
  if (ball.position.y <= tableTopY + BALL_RADIUS && ballVelocity.y < 0) {
    if (
      Math.abs(ball.position.x) < TABLE_WIDTH / 2 &&
      Math.abs(ball.position.z) < TABLE_LENGTH / 2
    ) {
      ball.position.y = tableTopY + BALL_RADIUS;
      ballVelocity.y *= -0.9;
      ballVelocity.x *= 0.995;
      ballVelocity.z *= 0.995;
    }
  }

  // Net collision (simplified)
  const netTopY = TABLE_TOP_Y + NET_HEIGHT;
  const nearNet = Math.abs(ball.position.z) < 0.06;
  const belowTop = ball.position.y < netTopY + BALL_RADIUS + 0.015;
  const withinNetX = Math.abs(ball.position.x) < (TABLE_WIDTH / 2 + NET_OVERHANG);
  if (nearNet && belowTop && withinNetX) {
    const sign = ballVelocity.z > 0 ? 1 : -1;
    ball.position.z = 0.06 * sign;
    ballVelocity.z *= -0.55;
    ballVelocity.y = Math.abs(ballVelocity.y) * 0.5 + 0.05;
  }

  // Paddle collisions
  const ballBox = new THREE.Box3().setFromObject(ball);
  const playerBox = new THREE.Box3().setFromObject(playerPaddle);
  const oppBox = new THREE.Box3().setFromObject(opponentPaddle);

  if (ballBox.intersectsBox(playerBox) && ballVelocity.z > 0) {
    ballVelocity.z *= -1.08;
    ballVelocity.x += (ball.position.x - playerPaddle.position.x) * 0.22;
    ballVelocity.y = 0.20;
  }
  if (ballBox.intersectsBox(oppBox) && ballVelocity.z < 0) {
    ballVelocity.z *= -1.08;
    ballVelocity.x += (ball.position.x - opponentPaddle.position.x) * 0.22;
    ballVelocity.y = 0.20;
  }

  // Scoring
  if (ball.position.z > TABLE_LENGTH / 2 + 2) {
    opponentScore++;
    opponentScoreElem.textContent = String(opponentScore);
    resetBall();
  }
  if (ball.position.z < -TABLE_LENGTH / 2 - 2) {
    playerScore++;
    playerScoreElem.textContent = String(playerScore);
    resetBall();
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
