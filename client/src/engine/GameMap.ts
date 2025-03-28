import * as THREE from 'three';

export class GameMap {
  protected scene: THREE.Scene;
  protected ground: THREE.Mesh;
  protected obstacles: THREE.Mesh[];
  protected materials: { [key: string]: THREE.Material };
  protected lights: THREE.Light[];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.obstacles = [];
    this.lights = [];
    this.ground = new THREE.Mesh();
    this.materials = this.createMaterials();
    this.createMap();
    this.setupLighting();
  }

  protected createMaterials(): { [key: string]: THREE.Material } {
    return {
      ground: new THREE.MeshStandardMaterial({
        color: 0x2B2B2B,
        roughness: 0.9,
        metalness: 0.1,
        vertexColors: true,
      }),
      nexusPlatform: new THREE.MeshStandardMaterial({
        color: 0x707070,
        roughness: 0.6,
        metalness: 0.4,
      }),
      nexusStructure: new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.5,
        metalness: 0.5,
      }),
      nexusAccent: new THREE.MeshStandardMaterial({
        color: 0x3080ff,
        roughness: 0.3,
        metalness: 0.7,
        emissive: 0x104080,
        emissiveIntensity: 0.5,
      }),
      barrier: new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.7,
        metalness: 0.3,
        transparent: true,
        opacity: 0.8,
      }),
      spawnCover: new THREE.MeshStandardMaterial({
        color: 0x506050,
        roughness: 0.9,
        metalness: 0.1,
      }),
      vegetation: new THREE.MeshStandardMaterial({
        color: 0x2D4F1E,
        roughness: 0.9,
        metalness: 0.1,
      }),
      ringWall: new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.7,
        metalness: 0.3,
      })
    };
  }

  private createMap(): void {
    this.createGround();
    this.createNexus();
    this.createSpawnArea();
  }

  private createGround(): void {
    // Create an even larger ground that extends beyond the playable area
    const groundGeometry = new THREE.PlaneGeometry(6000, 6000, 600, 600);
    this.ground = new THREE.Mesh(groundGeometry, this.materials.ground);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    
    // Add terrain variation and coloring
    const vertices = groundGeometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);
    
    // Create noise functions for different terrain features
    const createNoise = (x: number, z: number, scale: number, amplitude: number) => {
      return Math.sin(x * scale) * Math.cos(z * scale) * amplitude;
    };

    // Create multiple layers of noise for more natural terrain
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 2];
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      
      // Base terrain height
      let height = 0;
      
      // Create steep terrain walls at the very edge of the map
      if (distanceFromCenter > 2800) {
        height = Math.pow((distanceFromCenter - 2800) * 0.2, 2);
        // Add rocky cliff-like variations
        height += createNoise(x, z, 0.1, 5) * (distanceFromCenter - 2800) * 0.01;
      }
      // Create varied terrain in the outer areas
      else if (distanceFromCenter > 1800) {
        const transitionFactor = (distanceFromCenter - 1800) / 1000;
        height = Math.pow(transitionFactor * 20, 1.5);
        // Add rolling hills and valleys
        height += createNoise(x, z, 0.02, 8) * transitionFactor;
        height += createNoise(x, z, 0.05, 4) * transitionFactor;
      }
      // Create gentle slopes in the spawn area
      else if (distanceFromCenter > 250) {
        // Multiple layers of noise for natural-looking terrain
        height = createNoise(x, z, 0.02, 3);
        height += createNoise(x, z, 0.04, 1.5);
        height += createNoise(x, z, 0.08, 0.75);
        // Add gradual elevation change
        height += Math.pow((distanceFromCenter - 250) * 0.02, 1.5);
      }
      // Keep the approach to Nexus relatively flat but with subtle variation
      else if (distanceFromCenter > 100) {
        height = createNoise(x, z, 0.04, 0.3);
        height += createNoise(x, z, 0.08, 0.2);
      }
      // Nexus area - very subtle variation
      else {
        height = createNoise(x, z, 0.1, 0.1);
      }
      
      vertices[i + 1] = height;
      
      // Color variation based on height and distance
      const colorIndex = i * (3/3); // Convert vertex index to color index
      let terrainColor;
      
      if (distanceFromCenter > 2800) {
        // Rocky cliff colors
        terrainColor = new THREE.Color(0x2A2A2A);
        terrainColor.lerp(new THREE.Color(0x3A3A3A), Math.random() * 0.2);
      } else if (height > 10) {
        // Higher elevation - darker soil
        terrainColor = new THREE.Color(0x232323);
        terrainColor.lerp(new THREE.Color(0x2D2D2D), Math.random() * 0.15);
      } else if (height > 5) {
        // Mid elevation - mixed terrain
        terrainColor = new THREE.Color(0x282828);
        terrainColor.lerp(new THREE.Color(0x323232), Math.random() * 0.1);
      } else {
        // Lower areas - slightly lighter
        terrainColor = new THREE.Color(0x2D2D2D);
        terrainColor.lerp(new THREE.Color(0x353535), Math.random() * 0.1);
      }
      
      // Add subtle random variation
      terrainColor.multiplyScalar(0.95 + Math.random() * 0.1);
      
      colors[colorIndex] = terrainColor.r;
      colors[colorIndex + 1] = terrainColor.g;
      colors[colorIndex + 2] = terrainColor.b;
    }
    
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeometry.computeVertexNormals();
    this.scene.add(this.ground);
  }

  private createNexus(): void {
    const nexusGroup = new THREE.Group();
    
    // Main platform
    const platformGeometry = new THREE.CylinderGeometry(20, 20, 1, 32);
    const platform = new THREE.Mesh(platformGeometry, this.materials.nexusPlatform);
    platform.position.y = 10;
    platform.castShadow = true;
    platform.receiveShadow = true;
    nexusGroup.add(platform);

    // Central structure
    const centralGeometry = new THREE.CylinderGeometry(8, 8, 20, 16);
    const central = new THREE.Mesh(centralGeometry, this.materials.nexusStructure);
    central.position.y = 0;
    central.castShadow = true;
    central.receiveShadow = true;
    nexusGroup.add(central);

    // Add ramps at cardinal directions
    const rampGeometry = new THREE.BoxGeometry(5, 0.5, 15);
    const rampPositions = [
      { pos: [0, 5, 25], rot: [0.3, 0, 0] },
      { pos: [0, 5, -25], rot: [-0.3, Math.PI, 0] },
      { pos: [25, 5, 0], rot: [0.3, Math.PI / 2, 0] },
      { pos: [-25, 5, 0], rot: [0.3, -Math.PI / 2, 0] }
    ];

    rampPositions.forEach(({ pos, rot }) => {
      const ramp = new THREE.Mesh(rampGeometry, this.materials.nexusPlatform);
      ramp.position.set(pos[0], pos[1], pos[2]);
      ramp.rotation.set(rot[0], rot[1], rot[2]);
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      nexusGroup.add(ramp);
    });

    // Add protective barriers around the platform edge
    const barrierGeometry = new THREE.CylinderGeometry(19.5, 19.5, 2, 32, 1, true);
    const barrier = new THREE.Mesh(barrierGeometry, this.materials.barrier);
    barrier.position.y = 11;
    nexusGroup.add(barrier);

    // Add accent lights around the platform
    const accentGeometry = new THREE.TorusGeometry(19.7, 0.3, 16, 32);
    const accent = new THREE.Mesh(accentGeometry, this.materials.nexusAccent);
    accent.position.y = 10.5;
    accent.castShadow = true;
    nexusGroup.add(accent);

    // Add cover points (containers)
    const containerGeometry = new THREE.BoxGeometry(4, 2, 2);
    const containerPositions = [
      { pos: [0, 11, 15], rot: [0, 0.24768 * Math.PI / 4, 0] },
      { pos: [0, 11, -15], rot: [0, Math.PI / 4, 0] },
      { pos: [15, 11, 0], rot: [0, -Math.PI / 4, 0] },
      { pos: [-15, 11, 0], rot: [0, -Math.PI / 4, 0] }
    ];

    containerPositions.forEach(({ pos, rot }) => {
      const container = new THREE.Mesh(containerGeometry, this.materials.nexusStructure);
      container.position.set(pos[0], pos[1], pos[2]);
      container.rotation.set(rot[0], rot[1], rot[2]);
      container.castShadow = true;
      container.receiveShadow = true;
      this.obstacles.push(container);
      nexusGroup.add(container);
    });

    // Add the entire Nexus to the scene
    this.scene.add(nexusGroup);
  }

  private createSpawnArea(): void {
    const spawnGroup = new THREE.Group();
    
    // Create the ring wall around spawn area
    const ringWallRadius = 800;
    const ringWallGeometry = new THREE.CylinderGeometry(
      ringWallRadius,
      ringWallRadius + 20,
      40,
      64,
      1,
      true
    );
    const ringWall = new THREE.Mesh(ringWallGeometry, this.materials.ringWall);
    ringWall.position.y = 20;
    spawnGroup.add(ringWall);

    // Create large cover objects with gradient distribution
    const largeCovers = [
      { type: 'rock', scale: 8, count: 40 }, // Increased count
      { type: 'bunker', scale: 12, count: 20 }, // Increased count
      { type: 'barrier', scale: 10, count: 25 } // Increased count
    ];

    largeCovers.forEach(({ type, scale, count }) => {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        // Distribute covers from near Nexus to outer wall
        const minRadius = 150; // Closer to Nexus
        const radiusVariation = minRadius + Math.random() * (ringWallRadius * 0.9 - minRadius);
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;

        let coverGeometry;
        if (type === 'rock') {
          coverGeometry = new THREE.DodecahedronGeometry(scale);
        } else if (type === 'bunker') {
          coverGeometry = new THREE.BoxGeometry(scale * 2, scale, scale * 1.5);
        } else {
          coverGeometry = new THREE.CylinderGeometry(scale * 0.5, scale, scale * 2);
        }

        const cover = new THREE.Mesh(coverGeometry, this.materials.spawnCover);
        cover.position.set(
          x + (Math.random() - 0.5) * 20,
          scale + Math.random() * 2,
          z + (Math.random() - 0.5) * 20
        );
        cover.rotation.set(
          Math.random() * 0.3,
          Math.random() * Math.PI * 2,
          Math.random() * 0.3
        );
        cover.castShadow = true;
        cover.receiveShadow = true;
        this.obstacles.push(cover);
        spawnGroup.add(cover);
      }
    });
    
    // Add vegetation with density gradient
    const vegetationCount = 2500; // Significantly increased vegetation count
    const vegetationTypes = [
      { geometry: new THREE.ConeGeometry(1.5, 4, 8), scale: [1.2, 1.8, 1.2], weight: 0.6 }, // Larger pine trees with higher weight
      { geometry: new THREE.SphereGeometry(2, 8, 6), scale: [1.2, 1, 1.2], weight: 0.3 }, // Larger bushes
      { geometry: new THREE.CylinderGeometry(0.3, 0.3, 4, 6), scale: [1, 1.2, 1], weight: 0.1 } // Taller grass, lower weight
    ];
    
    for (let i = 0; i < vegetationCount; i++) {
      const angle = (i / vegetationCount) * Math.PI * 2 + Math.random() * 0.5;
      
      // Calculate base radius with minimum distance from center
      const minRadius = 100; // Slightly closer to Nexus
      const maxRadius = ringWallRadius * 0.98; // Closer to wall
      const baseRadius = minRadius + Math.random() * (maxRadius - minRadius);
      
      // Calculate density factor based on distance from center
      const densityFactor = Math.pow((baseRadius - minRadius) / (maxRadius - minRadius), 0.7); // More aggressive density scaling
      const clusterSizeMax = Math.floor(4 + densityFactor * 8); // Increased cluster size
      
      // Higher base probability for vegetation
      if (Math.random() < (0.4 + densityFactor * 0.6)) {
        const x = Math.cos(angle) * baseRadius;
        const z = Math.sin(angle) * baseRadius;
        
        // Create vegetation clusters with size based on density
        const clusterSize = Math.floor(Math.random() * clusterSizeMax) + 3; // Minimum 3 plants per cluster
        for (let j = 0; j < clusterSize; j++) {
          // Weight-based vegetation type selection
          const rand = Math.random();
          let typeIndex = 0;
          let weightSum = 0;
          for (let k = 0; k < vegetationTypes.length; k++) {
            weightSum += vegetationTypes[k].weight;
            if (rand < weightSum) {
              typeIndex = k;
              break;
            }
          }
          
          const vegetationType = vegetationTypes[typeIndex];
          const vegetation = new THREE.Mesh(vegetationType.geometry, this.materials.vegetation);
          
          // Position within cluster with larger spread in outer areas
          const clusterRadius = 8 + (densityFactor * 7); // Tighter clusters but more spread in outer areas
          const clusterAngle = (j / clusterSize) * Math.PI * 2 + Math.random() * 0.8; // More random distribution
          const clusterX = x + Math.cos(clusterAngle) * clusterRadius * Math.random();
          const clusterZ = z + Math.sin(clusterAngle) * clusterRadius * Math.random();
          
          // Scale based on distance - larger in outer areas
          const scaleFactor = 1.2 + (densityFactor * 0.4); // Increased base scale and scaling factor
          vegetation.position.set(
            clusterX,
            vegetationType.scale[1] * 1.8, // Increased base height
            clusterZ
          );
          vegetation.scale.set(
            vegetationType.scale[0] * scaleFactor * (1 + Math.random() * 0.4),
            vegetationType.scale[1] * scaleFactor * (1 + Math.random() * 0.4),
            vegetationType.scale[2] * scaleFactor * (1 + Math.random() * 0.4)
          );
          vegetation.rotation.y = Math.random() * Math.PI * 2;
          
          vegetation.castShadow = true;
          vegetation.receiveShadow = true;
          spawnGroup.add(vegetation);
        }
      }
    }
    
    this.scene.add(spawnGroup);
  }

  private setupLighting(): void {
    // Main ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.lights.push(ambientLight);
    this.scene.add(ambientLight);

    // Primary directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(500, 800, 500);
    sunLight.castShadow = true;
    
    // Adjust shadow properties for better quality
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 2000;
    sunLight.shadow.camera.left = -1000;
    sunLight.shadow.camera.right = 1000;
    sunLight.shadow.camera.top = 1000;
    sunLight.shadow.camera.bottom = -1000;
    sunLight.shadow.bias = -0.0005;
    
    this.lights.push(sunLight);
    this.scene.add(sunLight);

    // Secondary directional light for fill (opposite to sun)
    const fillLight = new THREE.DirectionalLight(0x8099ff, 0.3);
    fillLight.position.set(-300, 400, -300);
    this.lights.push(fillLight);
    this.scene.add(fillLight);

    // Add atmospheric lights around the ring wall
    const ringWallRadius = 800;
    const atmosphericLightCount = 8;
    for (let i = 0; i < atmosphericLightCount; i++) {
      const angle = (i / atmosphericLightCount) * Math.PI * 2;
      const x = Math.cos(angle) * ringWallRadius;
      const z = Math.sin(angle) * ringWallRadius;
      
      const atmosphericLight = new THREE.PointLight(0x4080ff, 0.6, 300);
      atmosphericLight.position.set(x, 30, z);
      this.lights.push(atmosphericLight);
      this.scene.add(atmosphericLight);
    }

    // Add subtle ground lights in the spawn area
    const groundLightCount = 12;
    const groundLightRadius = 400;
    for (let i = 0; i < groundLightCount; i++) {
      const angle = (i / groundLightCount) * Math.PI * 2;
      const x = Math.cos(angle) * groundLightRadius;
      const z = Math.sin(angle) * groundLightRadius;
      
      const groundLight = new THREE.PointLight(0x3060a0, 0.4, 200);
      groundLight.position.set(x, 15, z);
      this.lights.push(groundLight);
      this.scene.add(groundLight);
    }

    // Add dramatic uplighting to the Nexus
    const nexusLightCount = 4;
    const nexusLightRadius = 25;
    for (let i = 0; i < nexusLightCount; i++) {
      const angle = (i / nexusLightCount) * Math.PI * 2;
      const x = Math.cos(angle) * nexusLightRadius;
      const z = Math.sin(angle) * nexusLightRadius;
      
      const nexusLight = new THREE.SpotLight(0x3080ff, 1.5, 100, Math.PI / 6, 0.5, 1);
      nexusLight.position.set(x, 5, z);
      nexusLight.target.position.set(x * 0.2, 20, z * 0.2);
      this.scene.add(nexusLight.target);
      
      nexusLight.castShadow = true;
      nexusLight.shadow.mapSize.width = 512;
      nexusLight.shadow.mapSize.height = 512;
      nexusLight.shadow.camera.near = 0.5;
      nexusLight.shadow.camera.far = 100;
      
      this.lights.push(nexusLight);
      this.scene.add(nexusLight);
    }
  }

  public getObstacles(): THREE.Mesh[] {
    return this.obstacles;
  }

  public cleanup(): void {
    this.scene.remove(this.ground);
    this.obstacles.forEach(obstacle => {
      this.scene.remove(obstacle);
    });
    this.lights.forEach(light => {
      this.scene.remove(light);
      if (light instanceof THREE.SpotLight) {
        this.scene.remove(light.target);
      }
    });
    this.obstacles = [];
    this.lights = [];
  }
} 