import * as THREE from 'three';

/**
 * Asset priority levels
 */
export enum AssetPriority {
  CRITICAL = 'critical',    // Must load before game starts
  HIGH = 'high',            // Load as soon as possible
  MEDIUM = 'medium',        // Load during gameplay
  LOW = 'low',              // Load only when needed or during idle time
  PRELOAD = 'preload'       // Preload when bandwidth is available
}

/**
 * Asset status
 */
export enum AssetStatus {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}

/**
 * Asset type
 */
export type AssetType = 'texture' | 'model' | 'audio' | 'data' | 'shader';

/**
 * Asset metadata
 */
interface AssetInfo {
  id: string;
  url: string;
  type: AssetType;
  priority: AssetPriority;
  status: AssetStatus;
  data: any;
  size: number;
  loadTime?: number;
  dependencies?: string[];
  loaded: boolean;
  usageCount: number;
  lastUsed: number;
  loadPromise?: Promise<any>;
}

/**
 * Asset loading options
 */
interface AssetLoadOptions {
  priority?: AssetPriority;
  dependencies?: string[];
  preload?: boolean;
}

/**
 * Asset Manager manages loading and caching of game assets
 * including textures, models, audio, etc.
 */
export class AssetManager {
  private assets: Map<string, AssetInfo> = new Map();
  private loadingQueue: string[] = [];
  private textureLoader: THREE.TextureLoader;
  private maxConcurrentLoads: number = 4;
  private activeLoads: number = 0;
  private totalLoaded: number = 0;
  private totalAssets: number = 0;
  private totalLoadedBytes: number = 0;
  private isLoading: boolean = false;
  private onProgressCallback: ((progress: number) => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private cacheSize: number = 0;
  private maxCacheSize: number = 1024 * 1024 * 100; // 100 MB default cache size
  private currentCacheSize: number = 0;
  private loadingPaused: boolean = false;
  private defaultOptions: AssetLoadOptions = {
    priority: AssetPriority.MEDIUM,
    preload: false
  };
  
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }
  
  /**
   * Registers an asset for later loading
   */
  public registerAsset(
    id: string, 
    url: string, 
    type: AssetType, 
    size: number,
    options: AssetLoadOptions = {}
  ): void {
    if (this.assets.has(id)) {
      console.warn(`Asset with ID ${id} is already registered`);
      return;
    }
    
    // Merge default options with provided options
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Create asset definition
    const asset: AssetInfo = {
      id,
      url,
      type,
      priority: mergedOptions.priority!,
      status: AssetStatus.UNLOADED,
      data: null,
      size,
      loaded: false,
      usageCount: 0,
      lastUsed: Date.now()
    };
    
    this.assets.set(id, asset);
    
    this.totalAssets++;
    this.loadingQueue.push(id);
    
    // Sort queue by priority
    this.sortQueue();
    
    // Add to assets map
    this.assets.set(id, asset);
    
    // Add to loading queue if preload is enabled
    if (mergedOptions.preload || mergedOptions.priority === AssetPriority.CRITICAL) {
      this.queueAssetForLoading(id);
    }
  }
  
  /**
   * Sorts the loading queue by priority
   */
  private sortQueue(): void {
    this.loadingQueue.sort((a, b) => {
      const assetA = this.assets.get(a);
      const assetB = this.assets.get(b);
      
      if (!assetA || !assetB) return 0;
      
      // First by priority
      if (assetA.priority !== assetB.priority) {
        return assetA.priority.localeCompare(assetB.priority);
      }
      
      // Then by dependencies (if A depends on B, B should load first)
      if (assetA.dependencies?.includes(b)) return 1;
      if (assetB.dependencies?.includes(a)) return -1;
      
      return 0;
    });
  }
  
  /**
   * Starts loading registered assets
   */
  public startLoading(
    onProgress?: (progress: number) => void,
    onComplete?: () => void
  ): void {
    if (this.isLoading) {
      console.warn('Asset loading is already in progress');
      return;
    }
    
    this.isLoading = true;
    this.onProgressCallback = onProgress || null;
    this.onCompleteCallback = onComplete || null;
    
    // Start loading process
    this.processLoadingQueue();
  }
  
  /**
   * Loads the next batch of assets from the queue
   */
  private processLoadingQueue(): void {
    // If no more assets to load or if loading is complete
    if (this.loadingQueue.length === 0 || this.totalLoaded === this.totalAssets) {
      this.isLoading = false;
      
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
      
      return;
    }
    
    // Fill up to maxConcurrentLoads
    while (this.activeLoads < this.maxConcurrentLoads && this.loadingQueue.length > 0) {
      const assetId = this.loadingQueue.shift();
      if (!assetId) break;
      
      const asset = this.assets.get(assetId);
      if (!asset) continue;
      
      // Check if all dependencies are loaded
      const canLoad = !asset.dependencies || asset.dependencies.every(depId => {
        const dep = this.assets.get(depId);
        return dep && dep.status === AssetStatus.LOADED;
      });
      
      if (!canLoad) {
        // Put back at the end of the queue
        this.loadingQueue.push(assetId);
        continue;
      }
      
      // Start loading this asset
      this.loadAsset(assetId);
    }
  }
  
  /**
   * Loads a specific asset
   */
  private loadAsset(id: string): void {
    const asset = this.assets.get(id);
    if (!asset || asset.status === AssetStatus.LOADING || asset.status === AssetStatus.LOADED) {
      return;
    }
    
    asset.status = AssetStatus.LOADING;
    this.activeLoads++;
    
    const startTime = performance.now();
    
    let loadPromise: Promise<any>;
    
    switch (asset.type) {
      case 'texture':
        loadPromise = this.loadTexture(asset.url);
        break;
      case 'model':
        loadPromise = this.loadModel(asset.url);
        break;
      case 'audio':
        loadPromise = this.loadAudio(asset.url);
        break;
      case 'data':
        loadPromise = this.loadData(asset.url);
        break;
      case 'shader':
        loadPromise = this.loadShader(asset.url);
        break;
      default:
        console.error(`Unknown asset type: ${asset.type}`);
        this.handleAssetLoadComplete(asset, null, new Error(`Unknown asset type: ${asset.type}`));
        return;
    }
    
    asset.loadPromise = loadPromise;
    
    loadPromise
      .then(data => {
        asset.data = data;
        asset.status = AssetStatus.LOADED;
        asset.loadTime = performance.now() - startTime;
        
        // Update cache size
        this.cacheSize += asset.size;
        this.totalLoadedBytes += asset.size;
        
        // Add to front of LRU list
        this.lruList = this.lruList.filter(assetId => assetId !== id);
        this.lruList.unshift(id);
        
        // Check if we need to free up cache
        this.checkCacheSize();
      })
      .catch(error => {
        console.error(`Failed to load asset ${id}:`, error);
        asset.status = AssetStatus.ERROR;
      })
      .finally(() => {
        this.activeLoads--;
        this.totalLoaded++;
        
        // Update progress
        if (this.onProgressCallback) {
          this.onProgressCallback(this.totalLoaded / this.totalAssets);
        }
        
        // Load next batch
        this.processLoadingQueue();
      });
  }
  
  /**
   * Loads a texture asset
   */
  private loadTexture(url: string): Promise<any> {
    return this.textureLoader.loadAsync(url);
  }
  
  /**
   * Loads a 3D model asset
   */
  private loadModel(url: string): Promise<any> {
    // For simplicity, we're using a placeholder for model loading
    // In a real implementation, you would use GLTFLoader or another model loader
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ type: 'model', url });
      }, 500);
    });
  }
  
  /**
   * Loads an audio asset
   */
  private loadAudio(url: string): Promise<any> {
    const audio = new Audio();
    audio.src = url;
    
    return new Promise((resolve, reject) => {
      audio.oncanplaythrough = () => {
        resolve({ type: 'audio', url });
      };
      
      audio.onerror = () => {
        reject(new Error(`Failed to load audio: ${url}`));
      };
      
      // Start loading
      audio.load();
    });
  }
  
  /**
   * Loads a shader asset
   */
  private loadShader(url: string): Promise<any> {
    return fetch(url)
      .then(response => response.text())
      .then(data => {
        return { type: 'shader', url };
      })
      .catch(error => {
        console.error(`Failed to load shader: ${url}`, error);
        return null;
      });
  }
  
  /**
   * Handles completion of asset loading
   */
  private handleAssetLoadComplete(asset: AssetInfo, data: any, error?: Error): void {
    const loadTime = performance.now() - (asset.loadTime || performance.now());
    
    if (error) {
      console.error(`Failed to load asset ${asset.id}:`, error);
      asset.status = AssetStatus.ERROR;
    } else {
      asset.data = data;
      asset.status = AssetStatus.LOADED;
      asset.loadTime = loadTime;
      
      // Update cache size
      this.cacheSize += asset.size;
      this.totalLoadedBytes += asset.size;
      
      // Add to front of LRU list
      this.lruList = this.lruList.filter(assetId => assetId !== asset.id);
      this.lruList.unshift(asset.id);
      
      // Check if we need to free up cache
      this.checkCacheSize();
    }
    
    this.totalLoaded++;
    this.activeLoads--;
    
    // Update progress
    if (this.onProgressCallback) {
      this.onProgressCallback(this.totalLoaded / this.totalAssets);
    }
    
    // Load next batch
    this.processLoadingQueue();
  }
  
  /**
   * Checks if cache size exceeds limit and frees up space if needed
   */
  private checkCacheSize(): void {
    if (this.cacheSize <= this.maxCacheSize) return;
    
    // Remove least recently used assets until we're under the limit
    while (this.cacheSize > this.maxCacheSize && this.lruList.length > 0) {
      const lruId = this.lruList.pop();
      if (!lruId) break;
      
      const asset = this.assets.get(lruId);
      if (!asset || asset.priority === AssetPriority.CRITICAL) continue;
      
      // Only unload if not in CRITICAL priority
      this.unloadAsset(lruId);
    }
  }
  
  /**
   * Gets an asset by ID, loading it if necessary
   */
  public async getAsset(id: string): Promise<any> {
    const asset = this.assets.get(id);
    
    if (!asset) {
      throw new Error(`Asset with ID ${id} is not registered`);
    }
    
    // If already loaded, mark as recently used and return
    if (asset.status === AssetStatus.LOADED) {
      // Update LRU
      this.lruList = this.lruList.filter(assetId => assetId !== id);
      this.lruList.unshift(id);
      
      return asset.data;
    }
    
    // If loading, wait for it
    if (asset.status === AssetStatus.LOADING) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const currentState = this.assets.get(id);
          if (!currentState) {
            clearInterval(checkInterval);
            reject(new Error(`Asset ${id} was removed during loading`));
          } else if (currentState.status === AssetStatus.LOADED) {
            clearInterval(checkInterval);
            
            // Update LRU
            this.lruList = this.lruList.filter(assetId => assetId !== id);
            this.lruList.unshift(id);
            
            resolve(currentState.data);
          } else if (currentState.status === AssetStatus.ERROR) {
            clearInterval(checkInterval);
            reject(new Error(`Failed to load asset ${id}`));
          }
        }, 100);
      });
    }
    
    // If unloaded, start loading it with high priority
    asset.priority = AssetPriority.HIGH;
    
    // Remove from queue if present
    this.loadingQueue = this.loadingQueue.filter(assetId => assetId !== id);
    
    // Start loading
    this.loadAsset(id);
    
    // Return promise that resolves when loaded
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const currentState = this.assets.get(id);
        if (!currentState) {
          clearInterval(checkInterval);
          reject(new Error(`Asset ${id} was removed during loading`));
        } else if (currentState.status === AssetStatus.LOADED) {
          clearInterval(checkInterval);
          resolve(currentState.data);
        } else if (currentState.status === AssetStatus.ERROR) {
          clearInterval(checkInterval);
          reject(new Error(`Failed to load asset ${id}`));
        }
      }, 100);
    });
  }
  
  /**
   * Unloads an asset from memory
   */
  public unloadAsset(id: string): boolean {
    const asset = this.assets.get(id);
    
    if (!asset || asset.status !== AssetStatus.LOADED) {
      return false;
    }
    
    // Release memory
    if (asset.type === 'texture' && asset.data instanceof THREE.Texture) {
      asset.data.dispose();
    }
    
    // Update status
    asset.status = AssetStatus.UNLOADED;
    asset.data = null;
    
    // Update cache size
    this.cacheSize -= asset.size;
    
    // Remove from LRU list
    this.lruList = this.lruList.filter(assetId => assetId !== id);
    
    // Add back to loading queue with original priority
    this.loadingQueue.push(id);
    this.sortQueue();
    
    return true;
  }
  
  /**
   * Preloads assets of a certain priority level
   */
  public preloadAssets(priorityLevel: AssetPriority): void {
    for (const [id, asset] of this.assets.entries()) {
      if (asset.priority <= priorityLevel && asset.status === AssetStatus.UNLOADED) {
        // Remove if already in queue
        this.loadingQueue = this.loadingQueue.filter(assetId => assetId !== id);
        // Add to front of queue
        this.loadingQueue.unshift(id);
      }
    }
    
    // Resort queue
    this.sortQueue();
    
    // Start loading if not already
    if (!this.isLoading) {
      this.startLoading();
    }
  }
  
  /**
   * Gets the current load progress
   */
  public getLoadProgress(): number {
    if (this.totalAssets === 0) return 1;
    return this.totalLoaded / this.totalAssets;
  }
  
  /**
   * Gets memory usage stats
   */
  public getMemoryStats(): Record<string, number> {
    return {
      totalAssets: this.totalAssets,
      loadedAssets: this.totalLoaded,
      cacheSize: this.cacheSize,
      maxCacheSize: this.maxCacheSize,
      totalLoadedBytes: this.totalLoadedBytes
    };
  }
  
  /**
   * Sets maximum cache size in bytes
   */
  public setMaxCacheSize(sizeInBytes: number): void {
    this.maxCacheSize = sizeInBytes;
    this.checkCacheSize();
  }
  
  /**
   * Sets maximum concurrent loads
   */
  public setMaxConcurrentLoads(maxLoads: number): void {
    this.maxConcurrentLoads = maxLoads;
  }
  
  /**
   * Queue asset to be loaded
   */
  private queueAssetForLoading(id: string): void {
    // Skip if already in queue
    if (this.loadingQueue.includes(id)) {
      return;
    }
    
    const asset = this.assets.get(id);
    if (!asset || asset.loaded) {
      return;
    }
    
    // Insert into queue based on priority
    const idx = this.findInsertPosition(asset.priority);
    this.loadingQueue.splice(idx, 0, id);
    
    // Process queue if not paused
    if (!this.loadingPaused) {
      this.processLoadingQueue();
    }
  }
  
  /**
   * Find position to insert asset in queue based on priority
   */
  private findInsertPosition(priority: AssetPriority): number {
    const priorityOrder = {
      [AssetPriority.CRITICAL]: 0,
      [AssetPriority.HIGH]: 1,
      [AssetPriority.MEDIUM]: 2,
      [AssetPriority.LOW]: 3,
      [AssetPriority.PRELOAD]: 4
    };
    
    // Find position based on priority
    for (let i = 0; i < this.loadingQueue.length; i++) {
      const queuedAsset = this.assets.get(this.loadingQueue[i]);
      if (!queuedAsset) continue;
      
      const queuedPriority = priorityOrder[queuedAsset.priority];
      const newPriority = priorityOrder[priority];
      
      if (newPriority < queuedPriority) {
        return i;
      }
    }
    
    return this.loadingQueue.length;
  }
  
  /**
   * Pause asset loading (e.g. during gameplay-critical moments)
   */
  public pauseLoading(): void {
    this.loadingPaused = true;
  }
  
  /**
   * Resume asset loading
   */
  public resumeLoading(): void {
    this.loadingPaused = false;
    this.processLoadingQueue();
  }
  
  /**
   * Preload a group of assets (e.g. for next level)
   */
  public preloadAssets(assetIds: string[]): void {
    for (const id of assetIds) {
      this.queueAssetForLoading(id);
    }
  }
  
  // Simulated asset loaders
  private loadData(url: string): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ type: 'data', url });
      }, 20 + Math.random() * 100);
    });
  }
} 