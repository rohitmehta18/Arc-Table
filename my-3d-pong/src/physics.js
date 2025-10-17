// physics.js
import * as THREE from 'three';
import { updateScore, updateRally, showServeIndicator, hideStartButton, showRallyCounter } from './ui.js';

const GRAVITY = 9.8;
const AIR_RESISTANCE = 0.992;
const TABLE_RESTITUTION = 0.75;
const PADDLE_RESTITUTION = 1.25;
const MAX_BALL_SPEED = 2.0;
const MIN_BALL_SPEED = 0.3;
const SPIN_DECAY = 0.96;
const SPIN_INFLUENCE = 0.4;
const MAGNUS_EFFECT = 0.3;
const PADDLE_RADIUS = 0.45;
const BALL_RADIUS = 0.066;

export class PhysicsEngine {
  constructor(ball, table, net, playerPaddle, opponentPaddle, tableWidth, tableLength, tableTopY, netHeight, ballRadius, ui, controls) {
    this.ball = ball;
    this.table = table;
    this.net = net;
    this.playerPaddle = playerPaddle;
    this.opponentPaddle = opponentPaddle;
    this.tableWidth = tableWidth;
    this.tableLength = tableLength;
    this.tableTopY = tableTopY;
    this.netHeight = netHeight;
    this.ballRadius = ballRadius;
    this.ui = ui;
    this.controls = controls;

    this.gameState = {
      isPlaying: false,
      isServing: false,
      ballInPlay: false,
      lastHitBy: null,
      rallyCount: 0,
      serveCount: 0,
      ballTouchedTable: false,
      lastBounceSide: null,
      serveStage: null,
      serveNetTouch: false,
    };

    this.ballVelocity = new THREE.Vector3();
    this.ballSpin = new THREE.Vector3();
    this.ballAngularVelocity = new THREE.Vector3();

    this.playerScore = 0;
    this.opponentScore = 0;

    this.playerPaddleState = {
      lastHitTime: 0,
      hitCooldown: 0.1,
    };
  }

  startGame() {
    this.gameState.isPlaying = true;
    this.gameState.isServing = true;
    this.gameState.rallyCount = 0;
    this.gameState.serveCount = 0;
    this.playerScore = 0;
    this.opponentScore = 0;
    updateScore(this.ui, this.playerScore, this.opponentScore);
    hideStartButton(this.ui);
    showServeIndicator(this.ui, `SERVE ${this.gameState.serveCount}: POSITION PADDLE - CLICK TO SERVE`);
    showRallyCounter(this.ui, true);
    this.resetBallForServe();
  }

  resetBallForServe() {
    this.gameState.isServing = true;
    this.gameState.ballInPlay = false;
    this.gameState.lastHitBy = null;
    this.gameState.ballTouchedTable = false;
    this.gameState.lastBounceSide = null;
    this.gameState.serveStage = 'needServerBounce';
    this.gameState.serveNetTouch = false;
    this.gameState.serveCount++;

    this.ball.position.set(0, this.tableTopY + 0.8, this.playerPaddle.position.z - 0.6);
    this.ballVelocity.set(0, 0, 0);
    this.ballSpin.set(0, 0, 0);
    this.ballAngularVelocity.set(0, 0, 0);

    showServeIndicator(this.ui, `SERVE ${this.gameState.serveCount}: POSITION PADDLE - CLICK TO SERVE`);
  }

  executeServe(paddleVelocity) {
    if (!this.gameState.isServing) return;

    const servePower = 0.8 + Math.min(paddleVelocity.length() * 0.3, 0.2);
    const serveAngleX = this.playerPaddle.position.x * 0.1;
    const serveHeight = 0.4 + Math.random() * 0.2;

    this.ballVelocity.set(serveAngleX, serveHeight, -servePower);
    this.ballSpin.set((Math.random() > 0.5 ? -1 : 1) * 1.5, 0, 0);
    this.ballAngularVelocity.copy(this.ballSpin).multiplyScalar(5);

    this.gameState.isServing = false;
    this.gameState.ballInPlay = true;
    this.gameState.lastHitBy = 'player';
  }

  update(delta, ai) {
    if (!this.gameState.isPlaying) return;

    if (this.gameState.ballInPlay) {
      this.applyPhysics(delta);
      const hitNet = this.checkNetCollision();
      const hitTable = !hitNet && this.checkTableCollision();
      const hitPlayer = this.checkPaddleCollision(this.playerPaddle, true);
      const hitOpponent = this.checkPaddleCollision(this.opponentPaddle, false);

      if (this.checkRules()) {
        // Reset handled in checkRules
      }
    } else if (this.gameState.isServing) {
      // Ball follows paddle during positioning
      this.ball.position.copy(this.playerPaddle.position);
      this.ball.position.z -= 0.6;
      this.ball.position.y += 0.4;
    }
  }

  applyPhysics(delta) {
    this.ballVelocity.y -= GRAVITY * delta * 0.35;
    this.ballVelocity.multiplyScalar(AIR_RESISTANCE);

    // Magnus effect
    const magnus = new THREE.Vector3().crossVectors(this.ballAngularVelocity, this.ballVelocity).multiplyScalar(MAGNUS_EFFECT * delta);
    this.ballVelocity.add(magnus);

    // Spin influence
    this.ballVelocity.x += this.ballSpin.y * SPIN_INFLUENCE * delta;
    this.ballVelocity.z += this.ballSpin.x * SPIN_INFLUENCE * delta;

    this.ballSpin.multiplyScalar(SPIN_DECAY);
    this.ballAngularVelocity.multiplyScalar(SPIN_DECAY);

    // Speed limits
    let speed = this.ballVelocity.length();
    if (speed > MAX_BALL_SPEED) {
      this.ballVelocity.normalize().multiplyScalar(MAX_BALL_SPEED);
    }
    if (speed < MIN_BALL_SPEED && this.gameState.ballInPlay) {
      this.ballVelocity.normalize().multiplyScalar(MIN_BALL_SPEED);
    }

    this.ball.position.addScaledVector(this.ballVelocity, delta * 20);
  }

  checkTableCollision() {
    const tableTopY = this.tableTopY + this.ballRadius;
    const halfWidth = this.tableWidth / 2;
    const halfLength = this.tableLength / 2;

    if (this.ball.position.y <= tableTopY && this.ballVelocity.y < 0) {
      const xIn = Math.abs(this.ball.position.x) <= halfWidth;
      const zIn = Math.abs(this.ball.position.z) <= halfLength;

      if (xIn && zIn) {
        const side = this.ball.position.z > 0 ? 'player' : 'opponent';
        this.gameState.lastBounceSide = side;
        this.gameState.ballTouchedTable = true;

        this.ball.position.y = tableTopY;

        // Improved bounce with spin
        const normal = new THREE.Vector3(0, 1, 0);
        const vt = this.ballVelocity.clone().sub(normal.clone().multiplyScalar(this.ballVelocity.dot(normal)));
        const vn = this.ballVelocity.dot(normal);

        let e = TABLE_RESTITUTION;
        e += Math.min(-this.ballSpin.x * 0.1, 0.2);
        e = THREE.MathUtils.clamp(e, 0.6, 0.9);

        const friction = 0.8;
        const newVn = -vn * e;
        const newVt = vt.clone().multiplyScalar(friction);

        this.ballVelocity.copy(newVt).add(normal.clone().multiplyScalar(newVn));

        // Update spin on bounce
        this.ballSpin.x *= -0.6;
        this.ballSpin.y *= 0.8;

        // Serve logic
        if (this.gameState.serveStage === 'needServerBounce') {
          if (side === 'player') {
            this.gameState.serveStage = 'needReceiverBounce';
          } else {
            this.opponentScore++;
            updateScore(this.ui, this.playerScore, this.opponentScore);
            this.resetBallForServe();
            return true;
          }
        } else if (this.gameState.serveStage === 'needReceiverBounce') {
          if (side === 'opponent') {
            this.gameState.serveStage = null;
          } else {
            this.opponentScore++;
            updateScore(this.ui, this.playerScore, this.opponentScore);
            this.resetBallForServe();
            return true;
          }
        }

        return true;
      }
    }
    return false;
  }

  checkNetCollision() {
    const netZ = 0;
    const netTop = this.tableTopY + this.netHeight;
    const netBottom = this.tableTopY;
    const halfWidth = (this.tableWidth + 1.0) / 2;

    if (Math.abs(this.ball.position.z - netZ) < this.ballRadius && 
        this.ball.position.y > netBottom - this.ballRadius && 
        this.ball.position.y < netTop + this.ballRadius &&
        Math.abs(this.ball.position.x) < halfWidth) {

      // Net hit: reduce speed, random deflection
      this.ballVelocity.z *= -0.4;
      this.ballVelocity.y *= 0.5;
      this.ballVelocity.x += (Math.random() - 0.5) * 0.1;
      this.ballSpin.y += (Math.random() - 0.5) * 0.5;

      if (this.gameState.serveStage !== null) {
        this.gameState.serveNetTouch = true;
      }

      return true;
    }
    return false;
  }

  checkPaddleCollision(paddle, isPlayer) {
    const dist = this.ball.position.distanceTo(paddle.position);
    if (dist > PADDLE_RADIUS + this.ballRadius) return false;

    const now = performance.now() / 1000;
    const cooldown = isPlayer ? this.playerPaddleState.hitCooldown : 0.15;
    const lastHit = isPlayer ? this.playerPaddleState.lastHitTime : now - 1;

    if (now - lastHit < cooldown) return false;

    // Direction check: ball approaching paddle
    const towardPaddle = isPlayer ? this.ballVelocity.z > 0 : this.ballVelocity.z < 0;
    if (!towardPaddle && this.gameState.serveStage === null) return false;

    // Hit calculation
    const relPos = new THREE.Vector3().subVectors(this.ball.position, paddle.position);
    let paddleVel = new THREE.Vector3();
    if (isPlayer) {
      paddleVel = this.controls.velocity.clone();
    }
    const impact = this.ballVelocity.length();
    let power = impact * PADDLE_RESTITUTION + paddleVel.length() * 0.4;
    power = Math.min(power, MAX_BALL_SPEED);

    const angleX = THREE.MathUtils.clamp(relPos.x / PADDLE_RADIUS, -1, 1);
    const angleY = THREE.MathUtils.clamp(relPos.y / 0.6, -0.6, 0.6);

    const dir = isPlayer ? -1 : 1;

    this.ballVelocity.set(
      angleX * power * 0.6 + paddleVel.x * 0.3,
      Math.max(angleY * power * 0.4 + 0.2, 0.1),
      dir * power * 0.8
    );

    // Spin based on hit location and paddle motion
    if (isPlayer) {
      this.ballSpin.set(-relPos.y * 2, relPos.x * 2, paddleVel.length() * (Math.random() > 0.5 ? 1 : -1));
    } else {
      // AI strategic spin
      this.ballSpin.set((Math.random() > 0.5 ? 1 : -1) * 1.2, (Math.random() - 0.5), 0);
    }
    this.ballAngularVelocity.copy(this.ballSpin).multiplyScalar(6);

    this.gameState.lastHitBy = isPlayer ? 'player' : 'opponent';
    this.gameState.rallyCount++;
    this.gameState.ballTouchedTable = false;
    updateRally(this.ui, this.gameState.rallyCount);

    if (isPlayer) {
      this.playerPaddleState.lastHitTime = now;
    }

    return true;
  }

  checkRules() {
    const halfLength = this.tableLength / 2;
    const halfWidth = this.tableWidth / 2;
    const outThreshold = 0.1;

    // Out of bounds
    if (Math.abs(this.ball.position.x) > halfWidth + BALL_RADIUS + outThreshold ||
        this.ball.position.y < this.tableTopY - 2 ||
        Math.abs(this.ball.position.z) > halfLength + 3) {
      return this.scorePoint(this.gameState.lastHitBy === 'player' ? 'opponent' : 'player');
    }

    // No bounce on own side
    if (this.gameState.ballInPlay && this.gameState.ballTouchedTable && this.gameState.serveStage === null) {
      const expectedSide = this.gameState.lastHitBy === 'player' ? 'opponent' : 'player';
      if (this.gameState.lastBounceSide !== expectedSide) {
        return this.scorePoint(expectedSide);
      }
    }

    // Net let on serve
    if (this.gameState.serveNetTouch && this.gameState.serveStage === null) {
      this.resetBallForServe();
      return true;
    }

    return false;
  }

  scorePoint(winner) {
    if (winner === 'player') {
      this.playerScore++;
    } else {
      this.opponentScore++;
    }
    updateScore(this.ui, this.playerScore, this.opponentScore);

    // Check win condition (first to 11, win by 2)
    if (this.playerScore >= 11 || this.opponentScore >= 11) {
      const diff = Math.abs(this.playerScore - this.opponentScore);
      if (diff >= 2) {
        alert(`${winner.toUpperCase()} WINS!`);
        this.gameState.isPlaying = false;
      }
    }

    this.resetBallForServe();
    return true;
  }
}