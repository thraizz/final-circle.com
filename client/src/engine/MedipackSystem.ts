import * as THREE from 'three';
import { SoundManager } from './SoundManager';

export interface Medipack {
  id: string;
  position: THREE.Vector3;
  model: THREE.Object3D;
  isActive: boolean;
  respawnTime: number; // Time in seconds to respawn
  lastPickupTime: number | null;
}

// Create an interface for the particle with velocity
interface ParticleWithVelocity extends THREE.Mesh {
  velocity: THREE.Vector3;
}

export class MedipackSystem {
  private scene: THREE.Scene;
  private medipacks: Medipack[] = [];
  private soundManager: SoundManager;
  private static readonly HEALING_AMOUNT = 50; // Amount of health to restore
  private static readonly RESPAWN_TIME = 30; // Seconds until respawn
  private static readonly PICKUP_RANGE = 1.5; // Distance for pickup
  private medipackMaterial: THREE.MeshStandardMaterial;
  private medipackGeometry: THREE.BoxGeometry;
  private redCrossMaterial: THREE.MeshBasicMaterial;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.soundManager = SoundManager.getInstance();
    
    // Create reusable materials and geometries
    this.medipackMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.6
    });
    
    this.medipackGeometry = new THREE.BoxGeometry(0.5, 0.25, 0.5);
    
    this.redCrossMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide
    });
    
    // Load medipack sound
    this.soundManager.loadSound('medipack_pickup', '/assets/sounds/medipack_pickup.wav')
      .catch(error => {
        console.error('Error loading medipack sound:', error);
      });
  }
  
  /**
   * Create a medipack at the specified position
   */
  public createMedipack(position: THREE.Vector3, id: string): Medipack {
    // Create medipack model
    const medipackGroup = new THREE.Group();
    
    // Create the base box
    const medipackBase = new THREE.Mesh(this.medipackGeometry, this.medipackMaterial);
    medipackGroup.add(medipackBase);
    
    // Add red cross on top
    const crossGeometry = new THREE.PlaneGeometry(0.3, 0.05);
    const horizontalCross = new THREE.Mesh(crossGeometry, this.redCrossMaterial);
    horizontalCross.position.set(0, 0.13, 0);
    horizontalCross.rotation.x = -Math.PI / 2;
    medipackGroup.add(horizontalCross);
    
    const verticalCross = new THREE.Mesh(crossGeometry, this.redCrossMaterial);
    verticalCross.position.set(0, 0.13, 0);
    verticalCross.rotation.x = -Math.PI / 2;
    verticalCross.rotation.z = Math.PI / 2;
    medipackGroup.add(verticalCross);
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.2
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 0.1;
    medipackGroup.add(glow);
    
    // Position the medipack
    medipackGroup.position.copy(position);
    
    // Add a subtle floating animation
    const startY = position.y;
    const animateMedipack = () => {
      if (medipackGroup.parent) {
        medipackGroup.position.y = startY + Math.sin(Date.now() * 0.002) * 0.1;
        medipackGroup.rotation.y += 0.01;
        requestAnimationFrame(animateMedipack);
      }
    };
    
    animateMedipack();
    
    // Add to scene
    this.scene.add(medipackGroup);
    
    // Create medipack object
    const medipack: Medipack = {
      id,
      position,
      model: medipackGroup,
      isActive: true,
      respawnTime: MedipackSystem.RESPAWN_TIME,
      lastPickupTime: null
    };
    
    // Add to medipacks array
    this.medipacks.push(medipack);
    
    return medipack;
  }
  
  /**
   * Setup initial medipack spawns
   */
  public setupMedipacks(spawnPositions: THREE.Vector3[]): void {
    spawnPositions.forEach((position, index) => {
      this.createMedipack(position, `medipack_${index}`);
    });
  }
  
  /**
   * Check if player can pick up a medipack
   */
  public checkPickup(playerPosition: THREE.Vector3, playerHealth: number, maxHealth: number): number {
    // Only allow pickup if player doesn't have full health
    if (playerHealth >= maxHealth) return 0;
    
    let healingAmount = 0;
    
    this.medipacks.forEach(medipack => {
      if (medipack.isActive) {
        const distance = playerPosition.distanceTo(medipack.position);
        
        if (distance <= MedipackSystem.PICKUP_RANGE) {
          // Pick up medipack
          this.pickupMedipack(medipack);
          healingAmount = MedipackSystem.HEALING_AMOUNT;
        }
      }
    });
    
    return healingAmount;
  }
  
  /**
   * Handle medipack pickup
   */
  private pickupMedipack(medipack: Medipack): void {
    // Deactivate medipack
    medipack.isActive = false;
    medipack.lastPickupTime = Date.now();
    medipack.model.visible = false;
    
    // Play pickup sound
    this.soundManager.playSound('medipack_pickup');
    
    // Create pickup effect
    this.createPickupEffect(medipack.position.clone());
  }
  
  /**
   * Create a visual effect when picking up a medipack
   */
  private createPickupEffect(position: THREE.Vector3): void {
    // Create particles for pickup effect
    const particleCount = 15;
    const particles: ParticleWithVelocity[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.8
      });
      
      // Create the mesh and manually add velocity property
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      const particleWithVelocity = particle as unknown as ParticleWithVelocity;
      particleWithVelocity.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 3,
        (Math.random() - 0.5) * 2
      );
      
      // Random position around the medipack
      particleWithVelocity.position.copy(position);
      particleWithVelocity.position.x += (Math.random() - 0.5) * 0.5;
      particleWithVelocity.position.y += Math.random() * 0.5;
      particleWithVelocity.position.z += (Math.random() - 0.5) * 0.5;
      
      this.scene.add(particleWithVelocity);
      particles.push(particleWithVelocity);
    }
    
    // Animate particles
    const startTime = Date.now();
    const duration = 1000; // 1 second animation
    
    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
        particles.forEach(particle => {
          particle.position.x += particle.velocity.x * 0.02;
          particle.position.y += particle.velocity.y * 0.02;
          particle.position.z += particle.velocity.z * 0.02;
          
          // Fade out
          const material = particle.material as THREE.MeshBasicMaterial;
          material.opacity = 0.8 * (1 - progress);
        });
        
        requestAnimationFrame(animateParticles);
      } else {
        // Remove particles
        particles.forEach(particle => {
          this.scene.remove(particle);
        });
      }
    };
    
    animateParticles();
  }
  
  /**
   * Update medipacks - handle respawning
   */
  public update(): void {
    const currentTime = Date.now();
    
    this.medipacks.forEach(medipack => {
      if (!medipack.isActive && medipack.lastPickupTime) {
        const elapsedSeconds = (currentTime - medipack.lastPickupTime) / 1000;
        
        if (elapsedSeconds >= medipack.respawnTime) {
          // Respawn medipack
          medipack.isActive = true;
          medipack.model.visible = true;
          medipack.lastPickupTime = null;
        }
      }
    });
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.medipacks.forEach(medipack => {
      this.scene.remove(medipack.model);
    });
    
    this.medipacks = [];
  }
} 