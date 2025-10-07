import * as THREE from 'three';
// Import necessary components for post-processing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import './style.css';

//==================================================
// SCENE SETUP
//==================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pitch black for dramatic effect

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 11);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer, more realistic shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const gameContainer = document.getElementById('game-container')!;
gameContainer.appendChild(renderer.domElement);

//==================================================
// POST-PROCESSING (FOR GLOW EFFECT)
//==================================================
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5, // strength
    0.1, // radius
    0.1  // threshold
);
const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);


//==================================================
// LIGHTING
//==================================================
// Soft ambient light for the whole scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// A spotlight to simulate an overhead arena light
const spotLight = new THREE.SpotLight(0xffffff, 20, 30, Math.PI * 0.15, 0.2);
spotLight.position.set(0, 15, 0);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
scene.add(spotLight);


//==================================================
// GAME ELEMENTS
//==================================================
// Proportions based on official regulations (2.74m x 1.525m)
const TABLE_LENGTH = 9; // Represents 2.74m
const TABLE_WIDTH = 5;  // Represents 1.525m
const TABLE_HEIGHT = 0.25;
const PADDLE_WIDTH = 1.1;
const PADDLE_HEIGHT = 1.1;
const PADDLE_DEPTH = 0.2;
const BALL_RADIUS = 0.13;

// More advanced materials
const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x0041C2, roughness: 0.2, metalness: 0.0 }); // Tournament Blue
const whiteLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 });
const paddleRedMaterial = new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.6 });
const paddleBlackMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.1, metalness: 0.1 });
const netMaterial = new THREE.MeshBasicMaterial({ color: 0xeeeeee, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });

// --- Create the Table ---
const tableGroup = new THREE.Group();

const tableSurface = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH, TABLE_HEIGHT, TABLE_LENGTH), tableMaterial);
tableSurface.receiveShadow = true;
tableGroup.add(tableSurface);

const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, TABLE_LENGTH), whiteLineMaterial);
centerLine.position.y = TABLE_HEIGHT / 2 + 0.021;
tableGroup.add(centerLine);

// Simplified boundary lines
const sideLine1 = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH, 0.04, 0.04), whiteLineMaterial);
sideLine1.position.set(0, TABLE_HEIGHT / 2 + 0.021, -TABLE_LENGTH / 2);
tableGroup.add(sideLine1);

const sideLine2 = sideLine1.clone();
sideLine2.position.z = TABLE_LENGTH / 2;
tableGroup.add(sideLine2);

// --- Arena Environment ---
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
floor.receiveShadow = true;
scene.add(floor);

tableGroup.position.y = 1.5; // Raise the table
scene.add(tableGroup);

// --- Net ---
const net = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_WIDTH, 0.5), netMaterial);
net.position.y = tableGroup.position.y + TABLE_HEIGHT / 2 + 0.25;
net.rotation.x = Math.PI / 2;
scene.add(net);


// --- Paddles ---
const playerPaddle = new THREE.Mesh(new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_DEPTH), paddleRedMaterial);
playerPaddle.position.z = TABLE_LENGTH / 2 + 0.8;
playerPaddle.castShadow = true;
scene.add(playerPaddle);

const opponentPaddle = new THREE.Mesh(new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_DEPTH), paddleBlackMaterial);
opponentPaddle.position.z = -TABLE_LENGTH / 2 - 0.8;
opponentPaddle.castShadow = true;
scene.add(opponentPaddle);

// --- Ball ---
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 32, 32), ballMaterial);
ball.castShadow = true;
scene.add(ball);

//==================================================
// GAME LOGIC
//==================================================
let playerScore = 0, opponentScore = 0;
let ballVelocity = new THREE.Vector3(0, 0, 0.15);

const playerScoreElem = document.getElementById('player-score')!;
const opponentScoreElem = document.getElementById('opponent-score')!;

function resetBall() {
  ball.position.set(0, tableGroup.position.y + TABLE_HEIGHT / 2 + BALL_RADIUS, 0);
  
  const serveDirection = playerScore >= opponentScore ? -1 : 1;
  ballVelocity.x = Math.random() * 0.1 - 0.05;
  ballVelocity.y = 0.1; // Initial upward velocity for an arc
  ballVelocity.z = 0.15 * serveDirection;
}
resetBall();

//==================================================
// CONTROLS
//==================================================
const gamePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -playerPaddle.position.z);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(gamePlane, intersectPoint);
    
    playerPaddle.position.x = Math.max(-TABLE_WIDTH/2 + PADDLE_WIDTH/2, Math.min(TABLE_WIDTH/2 - PADDLE_WIDTH/2, intersectPoint.x));
    playerPaddle.position.y = Math.max(tableGroup.position.y, Math.min(4, intersectPoint.y));
});

//==================================================
// GAME LOOP
//==================================================
const clock = new THREE.Clock();
const GRAVITY = 9.8;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // 1. Ball Physics
  ballVelocity.y -= GRAVITY * delta * 0.2; // Scaled down gravity
  ball.position.addScaledVector(ballVelocity, delta * 15); // Framerate independent movement

  // 2. Opponent AI
  const aiSpeed = 4;
  const targetX = ball.position.x;
  opponentPaddle.position.x += (targetX - opponentPaddle.position.x) * aiSpeed * delta;
  opponentPaddle.position.x = Math.max(-TABLE_WIDTH/2 + PADDLE_WIDTH/2, Math.min(TABLE_WIDTH/2 - PADDLE_WIDTH/2, opponentPaddle.position.x));

  // 3. Collision Detection
  const tableTopY = tableGroup.position.y + TABLE_HEIGHT / 2;

  // Table bounce
  if (ball.position.y <= tableTopY + BALL_RADIUS && ballVelocity.y < 0) {
      if(Math.abs(ball.position.x) < TABLE_WIDTH/2 && Math.abs(ball.position.z) < TABLE_LENGTH/2){
        ball.position.y = tableTopY + BALL_RADIUS;
        ballVelocity.y *= -0.9; // Bounce with energy loss
      }
  }

  // Paddle collisions
  const ballBox = new THREE.Box3().setFromObject(ball);
  const playerBox = new THREE.Box3().setFromObject(playerPaddle);
  const opponentBox = new THREE.Box3().setFromObject(opponentPaddle);

  if (ballBox.intersectsBox(playerBox) && ballVelocity.z > 0) {
    ballVelocity.z *= -1.1;
    ballVelocity.x += (ball.position.x - playerPaddle.position.x) * 0.2;
    ballVelocity.y = 0.2; // Upward pop
  }
  if (ballBox.intersectsBox(opponentBox) && ballVelocity.z < 0) {
    ballVelocity.z *= -1.1;
    ballVelocity.x += (ball.position.x - opponentPaddle.position.x) * 0.2;
    ballVelocity.y = 0.2;
  }

  // 4. Scoring
  if (ball.position.z > TABLE_LENGTH / 2 + 2) {
    opponentScore++;
    opponentScoreElem.textContent = opponentScore.toString();
    resetBall();
  }
  if (ball.position.z < -TABLE_LENGTH / 2 - 2) {
    playerScore++;
    playerScoreElem.textContent = playerScore.toString();
    resetBall();
  }

  // 5. Render with composer
  composer.render();
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();

