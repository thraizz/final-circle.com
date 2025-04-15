import * as THREE from 'three';

/**
 * The LODManager handles dynamic Level of Detail (LOD) management and draw distance optimization
 * to improve rendering performance by:
 * 1. Avoiding rendering objects that are too far from the camera
 * 2. Using different detail levels for objects based on distance
 */
export class LODManager {
  private camera: THREE.PerspectiveCamera;
  
  // Object tracking for LOD management
  private trackedObjects: Map<string, TrackedObject> = new Map();
  
  // Configuration
  private maxDrawDistance: number = 1000;
  private lodLevels: LODLevel[] = [
    { distance: 0, detailFactor: 1.0 },    // Full detail (0-200 units)
    { distance: 200, detailFactor: 0.8 },  // High detail (200-400 units)
    { distance: 400, detailFactor: 0.5 },  // Medium detail (400-600 units)
    { distance: 600, detailFactor: 0.3 },  // Low detail (600-800 units)
    { distance: 800, detailFactor: 0.2 }   // Very low detail (800-1000 units)
  ];
  
  // Performance tracking
  private hiddenObjectCount: number = 0;
  private visibleObjectCount: number = 0;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 500; // Update LOD every 500ms
  
  constructor(camera: THREE.PerspectiveCamera, config?: LODConfig) {
    this.camera = camera;
    
    // Apply custom configuration if provided
    if (config) {
      if (config.maxDrawDistance !== undefined) {
        this.maxDrawDistance = config.maxDrawDistance;
      }
      if (config.lodLevels) {
        this.lodLevels = config.lodLevels;
      }
      if (config.updateInterval !== undefined) {
        this.updateInterval = config.updateInterval;
      }
    }
    
    this.lastUpdateTime = performance.now();
  }
  
  /**
   * Register objects for LOD management
   * @param objects Array of objects to register
   */
  public registerObjects(objects: TrackedObjectInfo[]): void {
    objects.forEach(objInfo => {
      this.trackedObjects.set(objInfo.id, {
        object: objInfo.object,
        originalVisible: objInfo.object.visible,
        objectType: objInfo.objectType || 'default',
        priority: objInfo.priority || 0,
        distance: 0,
        lodLevel: 0,
        userData: objInfo.userData || {}
      });
    });
    
    console.log(`LODManager: Registered ${objects.length} objects`);
  }
  
  /**
   * Register a single object for LOD management
   * @param id Unique identifier for the object
   * @param object THREE.Object3D to track
   * @param options Additional options for LOD tracking
   */
  public registerObject(id: string, object: THREE.Object3D, options?: {
    objectType?: string;
    priority?: number;
    userData?: Record<string, unknown>;
  }): void {
    this.trackedObjects.set(id, {
      object,
      originalVisible: object.visible,
      objectType: options?.objectType || 'default',
      priority: options?.priority || 0,
      distance: 0,
      lodLevel: 0,
      userData: options?.userData || {}
    });
  }
  
  /**
   * Unregister an object from LOD management
   * @param id Object ID to unregister
   */
  public unregisterObject(id: string): void {
    const trackedObj = this.trackedObjects.get(id);
    if (trackedObj) {
      // Restore original visibility
      trackedObj.object.visible = trackedObj.originalVisible;
      this.trackedObjects.delete(id);
    }
  }
  
  /**
   * Update LOD for all tracked objects based on camera position
   * @param forceUpdate Force update even if update interval hasn't elapsed
   */
  public update(forceUpdate: boolean = false): void {
    const currentTime = performance.now();
    
    // Skip update if not enough time has passed and not forced
    if (!forceUpdate && currentTime - this.lastUpdateTime < this.updateInterval) {
      return;
    }
    
    this.lastUpdateTime = currentTime;
    
    this.hiddenObjectCount = 0;
    this.visibleObjectCount = 0;
    
    // Camera position for distance calculation
    const cameraPosition = this.camera.position;
    
    // Update visibility for each tracked object
    this.trackedObjects.forEach((trackedObj, id) => {
      const object = trackedObj.object;
      
      // Skip if object no longer exists
      if (!object) {
        this.trackedObjects.delete(id);
        return;
      }
      
      // Make essential objects always visible
      if (object.name === 'ground') {
        object.visible = true;
        this.visibleObjectCount++;
        return;
      }
      
      // Calculate distance to camera
      const distance = cameraPosition.distanceTo(object.position);
      trackedObj.distance = distance;
      
      // Determine visibility and LOD level
      if (distance > this.maxDrawDistance) {
        // Beyond draw distance - hide object
        object.visible = false;
        this.hiddenObjectCount++;
      } else {
        // Within draw distance - determine LOD level
        const lodLevel = this.determineLODLevel(distance);
        trackedObj.lodLevel = lodLevel;
        
        // Update visibility based on distance
        object.visible = trackedObj.originalVisible;
        
        if (object.visible) {
          this.visibleObjectCount++;
          
          // Apply LOD optimizations based on object type
          this.applyLODOptimizations(trackedObj, lodLevel);
        } else {
          this.hiddenObjectCount++;
        }
      }
    });
  }
  
  /**
   * Determine the LOD level based on distance
   * @param distance Distance from camera
   * @returns The LOD level (0 = highest detail)
   */
  private determineLODLevel(distance: number): number {
    for (let i = this.lodLevels.length - 1; i >= 0; i--) {
      if (distance >= this.lodLevels[i].distance) {
        return i;
      }
    }
    return 0; // Default to highest detail
  }
  
  /**
   * Apply LOD optimizations based on object type and LOD level
   * @param trackedObj The tracked object
   * @param lodLevel Current LOD level
   */
  private applyLODOptimizations(trackedObj: TrackedObject, lodLevel: number): void {
    const detailFactor = this.lodLevels[lodLevel].detailFactor;
    const object = trackedObj.object;
    
    // Apply different optimizations based on object type
    switch (trackedObj.objectType) {
      case 'vegetation':
        // For vegetation we can adjust scale slightly at distance to reduce detail
        if (lodLevel > 0) {
          if (object.userData._originalScale) {
            const scaleReduction = 0.95 + (0.05 * detailFactor);
            object.scale.copy(object.userData._originalScale).multiplyScalar(scaleReduction);
          } else {
            // Store original scale if not done yet
            object.userData._originalScale = object.scale.clone();
          }
        }
        break;
        
      case 'instancedMesh':
        // For instanced meshes we'd update instance matrices, but this requires
        // modifying the specific implementation - leaving this as a placeholder
        if (object instanceof THREE.InstancedMesh) {
          // Instanced mesh optimization would go here if needed
        }
        break;
        
      case 'building':
        // Buildings could show simplified geometry at distance
        if (lodLevel > 2 && object.userData.simplifiedVersion) {
          // Switch to simplified version
          object.visible = false;
          object.userData.simplifiedVersion.visible = true;
        } else if (lodLevel <= 2 && object.userData.simplifiedVersion) {
          // Switch to detailed version
          object.visible = true;
          object.userData.simplifiedVersion.visible = false;
        }
        break;
        
      default:
        // Generic object - no special optimizations
        break;
    }
  }
  
  /**
   * Set the maximum draw distance
   * @param distance New maximum draw distance
   */
  public setMaxDrawDistance(distance: number): void {
    this.maxDrawDistance = distance;
    // Force an immediate update with the new distance
    this.update(true);
  }
  
  /**
   * Get performance statistics
   * @returns Statistics about visible and hidden objects
   */
  public getStats(): LODStats {
    return {
      trackedObjectCount: this.trackedObjects.size,
      visibleObjectCount: this.visibleObjectCount,
      hiddenObjectCount: this.hiddenObjectCount,
      drawDistance: this.maxDrawDistance
    };
  }
  
  /**
   * Clean up resources used by the LODManager
   */
  public cleanup(): void {
    // Reset visibility for all tracked objects
    this.trackedObjects.forEach(trackedObj => {
      trackedObj.object.visible = trackedObj.originalVisible;
    });
    
    // Clear tracked objects
    this.trackedObjects.clear();
  }
}

// Types
export interface LODConfig {
  maxDrawDistance?: number;
  lodLevels?: LODLevel[];
  updateInterval?: number;
}

export interface LODLevel {
  distance: number;
  detailFactor: number;
}

export interface TrackedObjectInfo {
  id: string;
  object: THREE.Object3D;
  objectType?: string;
  priority?: number;
  userData?: Record<string, unknown>;
}

interface TrackedObject {
  object: THREE.Object3D;
  originalVisible: boolean;
  objectType: string;
  priority: number;
  distance: number;
  lodLevel: number;
  userData: Record<string, unknown>;
}

export interface LODStats {
  trackedObjectCount: number;
  visibleObjectCount: number;
  hiddenObjectCount: number;
  drawDistance: number;
} 