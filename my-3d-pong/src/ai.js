// ai.js
import * as THREE from 'three';

export class OpponentAI {
  constructor(opponentPaddle, ball, tableWidth, tableLength, tableTopY, physics) {
    this.opponentPaddle = opponentPaddle;
    this.ball = ball;
    this.tableWidth = tableWidth;
    this.tableLength = tableLength;
    this.tableTopY = tableTopY;
    this.physics = physics;

    this.reactionTime = 0.2;
    this.accuracy = 0.85;
    this.moveSpeed = 8.0;
    this.predictionTime = 0.6;
    this.skillLevel = 0.9;
    this.lastHitTime = 0;
    this.targetPosition = new THREE.Vector3();
  }

  update(delta, physics) {
    if (!physics.gameState.ballInPlay || physics.gameState.lastHitBy !== 'player') return;

    // Predict ball position
    let predicted = this.ball.position.clone();
    let vel = physics.ballVelocity.clone();
    const steps = 15;
    const step = this.predictionTime / steps;

    for (let i = 0; i < steps; i++) {
      vel.y -= 9.8 * step * 0.35;
      vel.multiplyScalar(0.992);
      predicted.addScaledVector(vel, step * 20);

      // Simulate bounce
      if (predicted.y <= this.tableTopY + 0.066 && vel.y < 0 && 
          Math.abs(predicted.x) < this.tableWidth / 2 && 
          Math.abs(predicted.z) < this.tableLength / 2) {
        vel.y *= -0.75;
      }
    }

    // Add error for realism
    const error = (1 - this.accuracy) * 0.3;
    predicted.x += (Math.random() - 0.5) * error * this.tableWidth;
    predicted.y += (Math.random() - 0.5) * error * 0.5;

    // Clamp target
    this.targetPosition.x = THREE.MathUtils.clamp(predicted.x, -this.tableWidth / 2 + 0.45, this.tableWidth / 2 - 0.45);
    this.targetPosition.y = THREE.MathUtils.clamp(predicted.y, this.tableTopY + 0.4, this.tableTopY + 1.2);
    this.targetPosition.z = this.opponentPaddle.position.z;

    // Move to target
    const lerpFactor = Math.min(delta / this.reactionTime, 1) * this.moveSpeed * this.skillLevel;
    this.opponentPaddle.position.lerp(this.targetPosition, lerpFactor * 0.1);
  }
}