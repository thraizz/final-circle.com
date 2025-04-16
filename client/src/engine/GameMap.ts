import * as THREE from 'three';

export class GameMap {
  protected scene: THREE.Scene;
  protected renderer: THREE.WebGLRenderer;
  protected ground: THREE.Mesh;
  protected obstacles: THREE.Mesh[];
  protected materials: { [key: string]: THREE.Material };
  protected lights: THREE.Light[];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
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
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.2,
        vertexColors: true
      }),
      nexusPlatform: new THREE.MeshStandardMaterial({
        color: 0x707070,
        roughness: 0.4,
        metalness: 0.6
      }),
      nexusStructure: new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.3,
        metalness: 0.8
      }),
      nexusAccent: new THREE.MeshStandardMaterial({
        color: 0x3080ff,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x104080,
        emissiveIntensity: 2.0
      }),
      barrier: new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0.6
      }),
      spawnCover: new THREE.MeshStandardMaterial({
        color: 0x506050,
        roughness: 0.7,
        metalness: 0.3
      }),
      vegetation: new THREE.MeshStandardMaterial({
        color: 0x2D4F1E,
        roughness: 0.9,
        metalness: 0.1
      }),
      ringWall: new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.4,
        metalness: 0.7
      })
    };
  }

  private createMap(): void {
    this.createGround();
    this.createNexus();
    this.createSpawnArea();
  }

  private createGround(): void {
    // Create a wooden textured ground
    const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
    
    // Create a wooden textured material
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513, // Wood brown color
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    // Create a wood grain texture pattern with procedural approach
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    if (context) {
      // Create wood grain texture
      context.fillStyle = '#8B4513'; // Base wood color
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add wood grain lines
      for (let i = 0; i < 80; i++) {
        const lineWidth = 1 + Math.random() * 3;
        const x = Math.random() * canvas.width;
        
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.lineWidth = lineWidth;
        context.strokeStyle = `rgba(90, 50, 10, ${Math.random() * 0.5})`;
        context.stroke();
      }
      
      // Add some knots/swirls
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 5 + Math.random() * 20;
        
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(60, 30, 10, ${Math.random() * 0.8})`;
        context.fill();
      }
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(100, 100); // Repeat to cover the large ground
      
      groundMaterial.map = texture;
    }
    
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -1;
    this.ground.receiveShadow = true;
    this.ground.name = "ground";
    
    // Add the ground to the scene
    this.scene.add(this.ground);
    
    // Add decorative wooden border around central play area
    this.addWoodenBorder();
  }

  private addWoodenBorder(): void {
    // Create a darker wood material for the border
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x5D4037, // Darker brown
      roughness: 0.7,
      metalness: 0.2
    });
    
    // Create circular border
    const borderRadius = 900; // Just outside the ring wall
    const borderWidth = 20;
    
    const outerRing = new THREE.RingGeometry(
      borderRadius, 
      borderRadius + borderWidth, 
      64
    );
    
    const borderMesh = new THREE.Mesh(outerRing, borderMaterial);
    borderMesh.rotation.x = -Math.PI / 2;
    borderMesh.position.y = -0.95; // Slightly above the ground
    borderMesh.receiveShadow = true;
    this.scene.add(borderMesh);
    
    // Add decorative inlay patterns
    const inlayCount = 16;
    const inlayMaterial = new THREE.MeshStandardMaterial({
      color: 0xD7CCC8, // Light wood color
      roughness: 0.6,
      metalness: 0.3
    });
    
    for (let i = 0; i < inlayCount; i++) {
      const angle = (i / inlayCount) * Math.PI * 2;
      const x = Math.cos(angle) * (borderRadius + borderWidth/2);
      const z = Math.sin(angle) * (borderRadius + borderWidth/2);
      
      // Create diamond-shaped inlay
      const inlayGeometry = new THREE.CircleGeometry(5, 4);
      const inlay = new THREE.Mesh(inlayGeometry, inlayMaterial);
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(x, -0.9, z);
      inlay.rotation.z = angle + Math.PI/4; // Rotate to align with border
      inlay.receiveShadow = true;
      this.scene.add(inlay);
    }
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

    // Add light beam indicator over the central hub
    this.addNexusLightBeam(nexusGroup);

    // Add the entire Nexus to the scene
    this.scene.add(nexusGroup);
  }

  private addNexusLightBeam(nexusGroup: THREE.Group): void {
    // Create a light beam material
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0x3080ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    // Create a cone geometry for the light beam
    const beamHeight = 2000; // Height of the light beam
    const beamTopRadius = 15; // Radius at the top of the beam
    const beamBottomRadius = 8; // Radius at the bottom of the beam (matches nexus width)
    const beamGeometry = new THREE.CylinderGeometry(beamTopRadius, beamBottomRadius, beamHeight, 16);
    
    // Create the beam mesh
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = 20; // Position at the top of the nexus structure
    nexusGroup.add(beam);

    // Add a point light at the top of the beam for dynamic lighting effect
    const beamLight = new THREE.PointLight(0x3080ff, 2, 300);
    beamLight.position.y = beamHeight + 20;
    nexusGroup.add(beamLight);
    this.lights.push(beamLight);

    // Add a spotlight at the top of the beam for focused lighting
    const spotLight = new THREE.SpotLight(0x3080ff, 3, 400, Math.PI / 6, 0.5, 1);
    spotLight.position.y = beamHeight + 20;
    spotLight.target.position.y = 0;
    nexusGroup.add(spotLight);
    nexusGroup.add(spotLight.target);
    this.lights.push(spotLight);

    // Add a pulsing animation to the beam
    const animateBeam = () => {
      const time = Date.now() * 0.001;
      beam.material.opacity = 0.4 + Math.sin(time * 2) * 0.2; // Pulsing opacity
      beamLight.intensity = 1.5 + Math.sin(time * 2) * 0.5; // Pulsing light intensity
      spotLight.intensity = 2 + Math.sin(time * 2) * 0.5; // Pulsing spotlight intensity
      requestAnimationFrame(animateBeam);
    };
    animateBeam();
  }

  private createSpawnArea(): void {
    const spawnGroup = new THREE.Group();
    
    // Create the ring wall around spawn area
    const ringWallRadius = 800;
    const ringWallGeometry = new THREE.CylinderGeometry(
      ringWallRadius,
      ringWallRadius + 20,
      40,
      32,
      1,
      true
    );
    const ringWall = new THREE.Mesh(ringWallGeometry, this.materials.ringWall);
    ringWall.position.y = 20;
    spawnGroup.add(ringWall);

    // Reduced cover objects for better performance
    const largeCovers = [
      { type: 'rock', scale: 8, count: 20 },
      { type: 'bunker', scale: 12, count: 10 },
      { type: 'barrier', scale: 10, count: 15 }
    ];

    largeCovers.forEach(({ type, scale, count }) => {
      const geometry = type === 'rock' ? 
        new THREE.DodecahedronGeometry(scale) :
        type === 'bunker' ? 
          new THREE.BoxGeometry(scale * 2, scale, scale * 1.5) :
          new THREE.CylinderGeometry(scale * 0.5, scale, scale * 2);

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const minRadius = 150;
        const radiusVariation = minRadius + Math.random() * (ringWallRadius * 0.9 - minRadius);
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;

        const cover = new THREE.Mesh(geometry, this.materials.spawnCover);
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
    
    // Enhanced vegetation using InstancedMesh for better performance
    const vegetationTypes = [
      {
        geometry: new THREE.ConeGeometry(1.5, 4, 8),  // Increased segments for smoother trees
        baseScale: [1.2, 1.8, 1.2],
        count: 1500,  // Reduced count for better performance
        heightRange: [3, 6],  // Increased max height for more variety
        name: 'pine',
        color: 0x2D5F1E  // Medium green
      },
      {
        geometry: new THREE.SphereGeometry(2, 8, 6),  // Improved geometry
        baseScale: [1.2, 1, 1.2],
        count: 800,
        heightRange: [1.5, 2.8],  // Increased height range
        name: 'bush',
        color: 0x3A6B2A  // Slightly lighter green
      },
      {
        geometry: new THREE.CylinderGeometry(0.3, 0.3, 4, 6),  // Improved geometry
        baseScale: [1, 1.2, 1],
        count: 400,
        heightRange: [3, 4.5],  // Increased height range
        name: 'trunk',
        color: 0x4D3319  // Brown for trunks
      },
      // New vegetation types
      {
        geometry: new THREE.DodecahedronGeometry(1.8, 0),  // Low poly rock as ground cover
        baseScale: [1.0, 0.4, 1.0],
        count: 600,
        heightRange: [0.2, 0.6],
        name: 'rock',
        color: 0x808080  // Gray color
      },
      {
        geometry: new THREE.ConeGeometry(1.8, 5, 7),  // Larger conifers
        baseScale: [1.4, 2.0, 1.4],
        count: 600,
        heightRange: [5, 8],
        name: 'tall-pine',
        color: 0x1F4F0F  // Darker green
      }
    ];
    
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    
    vegetationTypes.forEach(({ geometry, baseScale, count, heightRange, name, color }) => {
      // Create custom material for each vegetation type for more variety
      const vegMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.9,
        metalness: 0.1
      });
      
      const instancedMesh = new THREE.InstancedMesh(
        geometry,
        vegMaterial,
        count
      );
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      instancedMesh.name = `vegetation-${name}`;
      
      // Create individual meshes for each vegetation instance for proper raycasting
      const actualInstanceCount = Math.min(count, 200); // Further limit to improve performance
      const vegetationMeshes: THREE.Mesh[] = [];
      
      // Create clusters of vegetation for more natural distribution
      const clusterCount = Math.floor(count / 20); // Each cluster has roughly 20 items
      const clusterPositions: { x: number, z: number }[] = [];
      
      // Generate cluster center points
      for (let c = 0; c < clusterCount; c++) {
        const angle = (Math.random() * Math.PI * 2);
        const minRadius = 150;
        const maxRadius = ringWallRadius * 0.98;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        
        clusterPositions.push({
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius
        });
      }
      
      for (let i = 0; i < count; i++) {
        // Pick a random cluster to place this vegetation in
        const cluster = clusterPositions[Math.floor(Math.random() * clusterPositions.length)];
        const clusterSpread = name === 'rock' ? 30 : 60; // Rocks are more tightly clustered
        
        // Position within cluster plus some randomness
        const x = cluster.x + (Math.random() - 0.5) * clusterSpread;
        const z = cluster.z + (Math.random() - 0.5) * clusterSpread;
        
        // Calculate distance from center for density distribution
        const distFromCenter = Math.sqrt(x * x + z * z);
        const minRadius = 150;
        const maxRadius = ringWallRadius * 0.98;
        const densityFactor = Math.pow((distFromCenter - minRadius) / (maxRadius - minRadius), 0.7);
        
        // Higher probability of placement in outer areas
        if (Math.random() < (0.4 + densityFactor * 0.6)) {
          // Randomize position within the area
          position.set(
            x + (Math.random() - 0.5) * 20,
            heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]),
            z + (Math.random() - 0.5) * 20
          );
          
          // Randomize rotation
          rotation.set(
            Math.random() * 0.2,
            Math.random() * Math.PI * 2,
            Math.random() * 0.2
          );
          
          // Scale based on distance from center and add some randomness
          const scaleFactor = 0.8 + (densityFactor * 0.6);
          scale.set(
            baseScale[0] * scaleFactor * (0.8 + Math.random() * 0.5),
            baseScale[1] * scaleFactor * (0.9 + Math.random() * 0.3),
            baseScale[2] * scaleFactor * (0.8 + Math.random() * 0.5)
          );
          
          matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
          instancedMesh.setMatrixAt(i, matrix);
          
          // For raycasting, create individual meshes for a subset of vegetation
          if (i < actualInstanceCount) {
            // Create an actual mesh for raycasting
            const vegetationMesh = new THREE.Mesh(geometry.clone(), vegMaterial);
            vegetationMesh.position.copy(position);
            vegetationMesh.rotation.copy(rotation);
            vegetationMesh.scale.copy(scale);
            vegetationMesh.updateMatrix();
            vegetationMesh.matrixAutoUpdate = false; // Performance optimization
            vegetationMesh.castShadow = true;
            vegetationMesh.receiveShadow = true;
            vegetationMesh.visible = false; // Hide the actual mesh, only used for raycasting
            vegetationMesh.name = `vegetation-${name}-${i}`;
            
            // Add to obstacles for raycasting
            this.obstacles.push(vegetationMesh);
            vegetationMeshes.push(vegetationMesh);
            spawnGroup.add(vegetationMesh);
          }
        }
      }
      
      instancedMesh.instanceMatrix.needsUpdate = true;
      spawnGroup.add(instancedMesh);
    });
    
    this.scene.add(spawnGroup);
  }

  private setupLighting(): void {
    // Main ambient light for base illumination - warmer color for wooden theme
    const ambientLight = new THREE.AmbientLight(0x8B7355, 0.8); // Warm ambient light
    this.lights.push(ambientLight);
    this.scene.add(ambientLight);

    // Primary directional light (sun) - warmer tone
    const sunLight = new THREE.DirectionalLight(0xFFF0E0, 2.0); // Warm sunlight
    sunLight.position.set(500, 1000, 500);
    sunLight.castShadow = true;
    
    // Optimized shadow settings
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    sunLight.shadow.camera.left = -2500;
    sunLight.shadow.camera.right = 2500;
    sunLight.shadow.camera.top = 2500;
    sunLight.shadow.camera.bottom = -2500;
    sunLight.shadow.bias = -0.0003;
    
    this.lights.push(sunLight);
    this.scene.add(sunLight);

    // Secondary fill light - subtle blue to create contrast
    const fillLight = new THREE.DirectionalLight(0xE0F0FF, 0.5);
    fillLight.position.set(-300, 400, -300);
    this.lights.push(fillLight);
    this.scene.add(fillLight);

    // Add some point lights for ambiance
    const pointLightColors = [0xFFA07A, 0xFFD700, 0xF08080]; // Soft warm colors
    const ringWallRadius = 800;
    
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * ringWallRadius * 0.7;
      const z = Math.sin(angle) * ringWallRadius * 0.7;
      
      const pointLight = new THREE.PointLight(
        pointLightColors[i % pointLightColors.length], 
        0.7, 
        200
      );
      pointLight.position.set(x, 15, z);
      this.lights.push(pointLight);
      this.scene.add(pointLight);
    }

    // Add minimal fog for atmosphere - using minimal density
    this.scene.fog = new THREE.FogExp2(0x8B7355, 0.00003);
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
    });
    this.obstacles = [];
    this.lights = [];
  }

  /**
   * Add a visual indicator for the draw distance boundary (for development only)
   * @param drawDistance The current draw distance
   * @param color The color of the indicator
   */
  public addDrawDistanceIndicator(drawDistance: number, color: number = 0x00ffff): THREE.Mesh {
    // Remove any existing indicator
    this.removeDrawDistanceIndicator();
    
    // Create a wireframe sphere to visualize the draw distance
    const geometry = new THREE.SphereGeometry(drawDistance, 32, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });
    
    const indicator = new THREE.Mesh(geometry, material);
    indicator.name = 'draw-distance-indicator';
    
    // The indicator should follow the camera, so we'll update its position in the game loop
    this.scene.add(indicator);
    
    return indicator;
  }
  
  /**
   * Remove the draw distance indicator if it exists
   */
  public removeDrawDistanceIndicator(): void {
    const indicator = this.scene.getObjectByName('draw-distance-indicator');
    if (indicator) {
      this.scene.remove(indicator);
    }
  }
} 