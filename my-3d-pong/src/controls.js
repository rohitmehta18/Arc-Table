// controls.js
import * as THREE from 'three';

export class Controls {
  constructor(camera, playerPaddle, ball, tableWidth, tableTopY, paddleRadius) {
    this.camera = camera;
    this.playerPaddle = playerPaddle;
    this.ball = ball;
    this.tableWidth = tableWidth;
    this.tableTopY = tableTopY;
    this.paddleRadius = paddleRadius;
    this.gamePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -playerPaddle.position.z);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.intersectPoint = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.lastPosition = new THREE.Vector3();
    this.lastPosition.copy(playerPaddle.position);
    this.isDragging = false;
    this.dragStart = new THREE.Vector2();
    this.isPlaying = false;
    this.isServing = false;
  }

  handleMouseMove(event) {
    if (!this.isPlaying) return;
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.updatePaddleFromMouse();
  }

  handleMouseDown(physics) {
    if (!this.isPlaying) {
      return; // Start only via button
    }
    if (this.isServing) {
      this.executeServe(physics);
    } else {
      this.isDragging = true;
      this.dragStart.set(this.mouse.x, this.mouse.y);
    }
  }

  handleTouchMove(event) {
    if (!this.isPlaying) return;
    event.preventDefault();
    const touch = event.touches[0];
    this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    this.updatePaddleFromMouse();
  }

  handleTouchStart(event, physics) {
    event.preventDefault();
    if (!this.isPlaying) {
      return; // Start only via button
    }
    if (this.isServing) {
      this.executeServe(physics);
    } else {
      this.isDragging = true;
      const touch = event.touches[0];
      this.dragStart.set((touch.clientX / window.innerWidth) * 2 - 1, -(touch.clientY / window.innerHeight) * 2 + 1);
    }
  }

  updatePaddleFromMouse() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.raycaster.ray.intersectPlane(this.gamePlane, this.intersectPoint)) {
      const clampX = THREE.MathUtils.clamp(
        this.intersectPoint.x,
        -this.tableWidth / 2 + this.paddleRadius,
        this.tableWidth / 2 - this.paddleRadius
      );
      const minY = this.tableTopY + 0.3;
      const maxY = this.tableTopY + 1.5;
      const clampY = THREE.MathUtils.clamp(this.intersectPoint.y, minY, maxY);
      this.playerPaddle.position.set(clampX, clampY, this.playerPaddle.position.z);

      if (this.isServing) {
        this.ball.position.copy(this.playerPaddle.position);
        this.ball.position.z -= 0.6;
        this.ball.position.y += 0.4;
      }
    }
  }

  updatePaddleVelocity(delta) {
    const currentPos = this.playerPaddle.position.clone();
    if (delta > 0) {
      this.velocity.subVectors(currentPos, this.lastPosition).divideScalar(delta);
    }
    this.lastPosition.copy(currentPos);
  }

  startGame(physics) {
    physics.startGame();
    this.isPlaying = true;
    this.isServing = true;
  }

  executeServe(physics) {
    physics.executeServe(this.velocity);
    this.isServing = false;
  }
}