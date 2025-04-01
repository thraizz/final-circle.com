/**
 * Performance monitoring system for the battle royale game
 * Tracks frame rate, memory usage, and other performance metrics
 */
interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

interface QualitySettings {
  drawDistance: number;
  shadowQuality: 'low' | 'medium' | 'high';
  textureQuality: 'low' | 'medium' | 'high';
  effectsLevel: 'low' | 'medium' | 'high';
  antialiasing: boolean;
}

interface PerformanceReport {
  fps: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  memory?: {
    used: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  };
  network: {
    ping: number;
    packetLoss: number;
  };
  timings: {
    render: number;
    logic: number;
    network: number;
  };
}

export class PerformanceMonitor {
  private fpsHistory: number[] = [];
  private fpsUpdateInterval: number = 500; // ms
  private lastFpsUpdate: number = 0;
  private frameCount: number = 0;
  private renderTimes: number[] = [];
  private logicTimes: number[] = [];
  private networkTimes: number[] = [];
  private assetLoadTimes: Map<string, number> = new Map();
  private isPerformanceApiSupported: boolean;
  private memoryHistory: {timestamp: number, used: number}[] = [];
  private memoryUpdateInterval: number = 5000; // ms
  private lastMemoryUpdate: number = 0;
  private pingHistory: {timestamp: number, ping: number}[] = [];
  private pingsSent: number = 0;
  private pingsReceived: number = 0;
  
  // Settings that can be adjusted based on performance
  private qualitySettings: QualitySettings = {
    drawDistance: 1000,
    shadowQuality: 'high',
    textureQuality: 'high',
    effectsLevel: 'high',
    antialiasing: true
  };
  
  // Performance thresholds for adaptive quality
  private thresholds = {
    lowFps: 30,
    mediumFps: 45,
    highFps: 60,
    criticalMemory: 0.9  // 90% of available memory
  };
  
  constructor() {
    this.isPerformanceApiSupported = typeof performance !== 'undefined' && 
      typeof (performance as ExtendedPerformance).memory !== 'undefined';
    
    // Keep FPS history for the last 60 seconds (120 samples at 500ms interval)
    this.fpsHistory = new Array(120).fill(0);
    
    // Initial memory reading if supported
    if (this.isPerformanceApiSupported) {
      this.updateMemoryUsage();
    }
  }
  
  /**
   * Records the start of a frame for timing purposes
   */
  public startFrame(): number {
    return performance.now();
  }
  
  /**
   * Updates FPS counter at the specified interval
   * @param now Current timestamp
   * @param frameStart Frame start timestamp
   */
  public endFrame(now: number, frameStart: number): void {
    // Count frames
    this.frameCount++;
    
    // Record render time
    this.renderTimes.push(now - frameStart);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }
    
    // Update FPS counter at regular intervals
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      const elapsedSec = (now - this.lastFpsUpdate) / 1000;
      const currentFps = this.frameCount / elapsedSec;
      
      // Store in history, shifting values
      this.fpsHistory.push(currentFps);
      this.fpsHistory.shift();
      
      // Reset counters
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      
      // Check if we should update memory as well (less frequent)
      if (now - this.lastMemoryUpdate >= this.memoryUpdateInterval) {
        this.updateMemoryUsage();
        this.lastMemoryUpdate = now;
      }
      
      // Adapt quality settings based on performance if needed
      this.adaptQuality(currentFps);
    }
  }
  
  /**
   * Records logic update time
   */
  public recordLogicTime(time: number): void {
    this.logicTimes.push(time);
    if (this.logicTimes.length > 100) {
      this.logicTimes.shift();
    }
  }
  
  /**
   * Records network operation time
   */
  public recordNetworkTime(time: number): void {
    this.networkTimes.push(time);
    if (this.networkTimes.length > 100) {
      this.networkTimes.shift();
    }
  }
  
  /**
   * Records asset loading time
   */
  public recordAssetLoadTime(assetId: string, time: number): void {
    this.assetLoadTimes.set(assetId, time);
  }
  
  /**
   * Records a ping time
   */
  public recordPing(pingTime: number): void {
    this.pingHistory.push({timestamp: performance.now(), ping: pingTime});
    this.pingsReceived++;
    
    // Keep only the last 100 ping values
    if (this.pingHistory.length > 100) {
      this.pingHistory.shift();
    }
  }
  
  /**
   * Called when sending a ping
   */
  public sendPing(): void {
    this.pingsSent++;
  }
  
  /**
   * Updates memory usage statistics if supported
   */
  private updateMemoryUsage(): void {
    if (!this.isPerformanceApiSupported) return;
    
    const memory = (performance as ExtendedPerformance).memory;
    if (!memory) return;

    const used = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    this.memoryHistory.push({
      timestamp: performance.now(),
      used
    });
    
    // Keep only the last 60 memory snapshots (5 minutes at 5s interval)
    if (this.memoryHistory.length > 60) {
      this.memoryHistory.shift();
    }
  }
  
  /**
   * Adapts quality settings based on performance metrics
   */
  private adaptQuality(currentFps: number): void {
    // Only adapt if FPS is below threshold
    if (currentFps > this.thresholds.highFps) {
      // Performance is good, no need to adapt
      return;
    }
    
    // Check memory usage as well if supported
    let memoryPressure = false;
    if (this.isPerformanceApiSupported && this.memoryHistory.length > 0) {
      const latestMemory = this.memoryHistory[this.memoryHistory.length - 1].used;
      memoryPressure = latestMemory > this.thresholds.criticalMemory;
    }
    
    // Severe performance issues
    if (currentFps < this.thresholds.lowFps || memoryPressure) {
      this.qualitySettings = {
        drawDistance: 500,
        shadowQuality: 'low',
        textureQuality: 'low',
        effectsLevel: 'low',
        antialiasing: false
      };
      console.warn('Performance: Adjusting to low quality settings');
    }
    // Moderate performance issues
    else if (currentFps < this.thresholds.mediumFps) {
      this.qualitySettings = {
        drawDistance: 750,
        shadowQuality: 'medium',
        textureQuality: 'medium',
        effectsLevel: 'medium',
        antialiasing: false
      };
      console.warn('Performance: Adjusting to medium quality settings');
    }
  }
  
  /**
   * Gets a summary of performance metrics
   */
  public getPerformanceReport(): PerformanceReport {
    // Calculate FPS stats
    const currentFps = this.fpsHistory[this.fpsHistory.length - 1] || 0;
    const averageFps = this.calculateAverage(this.fpsHistory);
    const minFps = Math.min(...this.fpsHistory.filter(fps => fps > 0));
    const maxFps = Math.max(...this.fpsHistory);
    
    // Calculate timing averages
    const averageRenderTime = this.calculateAverage(this.renderTimes);
    const averageLogicTime = this.calculateAverage(this.logicTimes);
    const averageNetworkTime = this.calculateAverage(this.networkTimes);
    
    // Calculate network stats
    const averagePing = this.calculateAverage(this.pingHistory.map(p => p.ping));
    const packetLoss = this.calculatePacketLoss();
    
    const report: PerformanceReport = {
      fps: {
        current: currentFps,
        average: averageFps,
        min: minFps,
        max: maxFps
      },
      network: {
        ping: averagePing,
        packetLoss
      },
      timings: {
        render: averageRenderTime,
        logic: averageLogicTime,
        network: averageNetworkTime
      }
    };
    
    // Add memory stats if supported
    if (this.isPerformanceApiSupported && this.memoryHistory.length > 0) {
      const latestMemory = this.memoryHistory[this.memoryHistory.length - 1].used;
      report.memory = {
        used: latestMemory,
        trend: this.calculateMemoryTrend()
      };
    }
    
    return report;
  }
  
  /**
   * Calculates average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calculates packet loss percentage based on ping statistics
   */
  private calculatePacketLoss(): number {
    if (this.pingsSent === 0) return 0;
    return 100 * (1 - (this.pingsReceived / this.pingsSent));
  }
  
  /**
   * Calculates memory usage trend (increasing/decreasing)
   */
  private calculateMemoryTrend(): 'stable' | 'increasing' | 'decreasing' {
    if (this.memoryHistory.length < 5) return 'stable';
    
    // Get the last 5 memory readings
    const recent = this.memoryHistory.slice(-5);
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    const diff = last - first;
    
    if (Math.abs(diff) < 0.05) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }
  
  /**
   * Gets the current quality settings
   */
  public getQualitySettings(): QualitySettings {
    return { ...this.qualitySettings };
  }
  
  /**
   * Sets quality settings manually
   */
  public setQualitySettings(settings: Partial<QualitySettings>): void {
    this.qualitySettings = { ...this.qualitySettings, ...settings };
  }
} 