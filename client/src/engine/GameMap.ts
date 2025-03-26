import * as THREE from 'three';

export class GameMap {
  private scene: THREE.Scene;
  private ground: THREE.Mesh = new THREE.Mesh();
  private obstacles: THREE.Mesh[];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.obstacles = [];
    this.createMap();
  }

  private createMap(): void {
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x404040,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Create some obstacles
    this.createObstacles();
  }

  private createObstacles(): void {
    // Create some boxes as obstacles
    const obstaclePositions = [
      { x: 5, y: 1, z: 5 },
      { x: -5, y: 1, z: -5 },
      { x: 0, y: 1, z: 10 },
      { x: 10, y: 1, z: 0 },
    ];

    obstaclePositions.forEach(pos => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.7,
        metalness: 0.3,
      });
      const obstacle = new THREE.Mesh(geometry, material);
      obstacle.position.set(pos.x, pos.y, pos.z);
      obstacle.castShadow = true;
      obstacle.receiveShadow = true;
      this.scene.add(obstacle);
      this.obstacles.push(obstacle);
    });
  }

  public getObstacles(): THREE.Mesh[] {
    return this.obstacles;
  }

  public cleanup(): void {
    this.scene.remove(this.ground);
    this.obstacles.forEach(obstacle => {
      this.scene.remove(obstacle);
    });
    this.obstacles = [];
  }
} 