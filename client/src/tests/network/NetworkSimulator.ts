/**
 * Network Simulator for testing the game under various network conditions
 * Allows simulation of latency, packet loss, and other network characteristics
 */

export interface NetworkCondition {
  latencyMin: number;       // Minimum latency in milliseconds
  latencyMax: number;       // Maximum latency in milliseconds (for jitter)
  packetLoss: number;       // Packet loss rate (0-1)
  packetDuplication: number; // Packet duplication rate (0-1)
  packetCorruption: number;  // Packet corruption rate (0-1)
  disconnectRate: number;    // Random disconnection rate (0-1)
  reconnectDelay: number;    // Time to reconnect after disconnect (ms)
  bandwidth: number;         // Bandwidth limit in bytes per second (0 for unlimited)
}

/**
 * Predefined network conditions for testing
 */
export const NetworkConditions = {
  // Perfect network conditions (no issues)
  PERFECT: {
    latencyMin: 0,
    latencyMax: 5,
    packetLoss: 0,
    packetDuplication: 0,
    packetCorruption: 0,
    disconnectRate: 0,
    reconnectDelay: 0,
    bandwidth: 0 // unlimited
  },
  
  // Good network conditions (minimal issues)
  GOOD: {
    latencyMin: 20,
    latencyMax: 50,
    packetLoss: 0.001,
    packetDuplication: 0,
    packetCorruption: 0,
    disconnectRate: 0.0001,
    reconnectDelay: 1000,
    bandwidth: 10485760 // 10 MB/s
  },
  
  // Average network conditions
  AVERAGE: {
    latencyMin: 50,
    latencyMax: 150,
    packetLoss: 0.01,
    packetDuplication: 0.001,
    packetCorruption: 0.001,
    disconnectRate: 0.001,
    reconnectDelay: 2000,
    bandwidth: 2097152 // 2 MB/s
  },
  
  // Poor network conditions
  POOR: {
    latencyMin: 150,
    latencyMax: 300,
    packetLoss: 0.05,
    packetDuplication: 0.01,
    packetCorruption: 0.01,
    disconnectRate: 0.01,
    reconnectDelay: 5000,
    bandwidth: 524288 // 512 KB/s
  },
  
  // Terrible network conditions
  TERRIBLE: {
    latencyMin: 300,
    latencyMax: 1000,
    packetLoss: 0.2,
    packetDuplication: 0.05,
    packetCorruption: 0.05,
    disconnectRate: 0.05,
    reconnectDelay: 10000,
    bandwidth: 131072 // 128 KB/s
  },
  
  // Mobile 3G connection
  MOBILE_3G: {
    latencyMin: 100,
    latencyMax: 200,
    packetLoss: 0.02,
    packetDuplication: 0.005,
    packetCorruption: 0.005,
    disconnectRate: 0.02,
    reconnectDelay: 3000,
    bandwidth: 1048576 // 1 MB/s
  },
  
  // Mobile 4G connection
  MOBILE_4G: {
    latencyMin: 50,
    latencyMax: 100,
    packetLoss: 0.01,
    packetDuplication: 0.002,
    packetCorruption: 0.002,
    disconnectRate: 0.005,
    reconnectDelay: 2000,
    bandwidth: 5242880 // 5 MB/s
  }
};

/**
 * Message types for simulated WebSocket
 */
enum MessageType {
  OPEN = 'open',
  MESSAGE = 'message',
  ERROR = 'error',
  CLOSE = 'close',
}

/**
 * Interface for messages in the simulation queue
 */
interface SimulatedMessage {
  type: MessageType;
  data?: any;
  event?: Event;
  code?: number;
  reason?: string;
}

/**
 * Type for event listeners
 */
type EventCallback = (event: any) => void;

/**
 * Mock WebSocket class that simulates network conditions
 */
export class MockWebSocket {
  url: string;
  protocol: string | string[];
  readyState: number;
  bufferedAmount: number;
  extensions: string;
  binaryType: BinaryType;
  
  private _isConnecting: boolean;
  private _isConnected: boolean;
  private _isClosed: boolean;
  private _conditions: NetworkCondition;
  private _messageQueue: Array<SimulatedMessage>;
  private _eventListeners: {[key: string]: EventCallback[]};
  private _sendBuffer: number;
  private _bandwidthInterval: number | null;
  private _lastMessageTime: number;
  private _originalWebSocket: WebSocket | null;
  private _bandwidthThrottleTimeout: ReturnType<typeof setTimeout> | null;
  
  // WebSocket readyState constants
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  
  constructor(url: string, protocols?: string | string[], conditions: NetworkCondition = NetworkConditions.PERFECT) {
    this.url = url;
    this.protocol = protocols || '';
    this.readyState = MockWebSocket.CONNECTING;
    this.bufferedAmount = 0;
    this.extensions = '';
    this.binaryType = 'blob';
    
    this._isConnecting = true;
    this._isConnected = false;
    this._isClosed = false;
    this._conditions = conditions;
    this._messageQueue = [];
    this._eventListeners = {
      'open': [],
      'message': [],
      'error': [],
      'close': []
    };
    this._sendBuffer = 0;
    this._bandwidthInterval = null;
    this._lastMessageTime = 0;
    this._originalWebSocket = null;
    this._bandwidthThrottleTimeout = null;
    
    // Initialize bandwidth control if bandwidth is limited
    if (this._conditions.bandwidth > 0) {
      this._initBandwidthControl();
    }
    
    // Simulate connection process
    this._connect();
    
    // Set up random disconnection if specified
    if (this._conditions.disconnectRate > 0) {
      this._scheduleRandomDisconnect();
    }
  }
  
  // Event handlers
  onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  onerror: ((this: WebSocket, ev: Event) => any) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
  
  /**
   * Simulates the connection process with latency
   */
  private _connect(): void {
    // Simulate connection latency
    const connectLatency = this._getRandomLatency();
    
    setTimeout(() => {
      // Random connection failure based on packet loss
      if (Math.random() < this._conditions.packetLoss) {
        this.readyState = MockWebSocket.CLOSED;
        this._isClosed = true;
        this._isConnecting = false;
        
        const errorEvent = new Event('error');
        this._triggerError(new Error('Connection failed'));
        
        setTimeout(() => {
          this._triggerClose(1006, 'Connection failed');
        }, 0);
        
        return;
      }
      
      // Successful connection
      this.readyState = MockWebSocket.OPEN;
      this._isConnected = true;
      this._isConnecting = false;
      
      // Trigger open event
      this._triggerOpen();
    }, connectLatency);
  }
  
  /**
   * Sends data through the simulated WebSocket
   */
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Calculate data size for bandwidth throttling
    let dataSize = 0;
    if (typeof data === 'string') {
      dataSize = new Blob([data]).size;
    } else if (data instanceof Blob) {
      dataSize = data.size;
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      dataSize = data.byteLength;
    }
    
    // Apply bandwidth throttling if configured
    if (this._conditions.bandwidth > 0) {
      this._addToBandwidthBuffer(dataSize);
    }
    
    // Check for packet loss
    if (Math.random() < this._conditions.packetLoss) {
      console.log('[NetworkSimulator] Packet lost in send');
      return; // Packet is lost, don't deliver
    }
    
    // Check for packet duplication
    const duplicationCount = Math.random() < this._conditions.packetDuplication ? 2 : 1;
    
    // Send the packet (possibly duplicated)
    for (let i = 0; i < duplicationCount; i++) {
      setTimeout(() => {
        // Only send if still connected
        if (this._isConnected) {
          // If we have an original WebSocket (when we're patching), forward the send
          if (this._originalWebSocket && this._originalWebSocket.readyState === WebSocket.OPEN) {
            this._originalWebSocket.send(data);
          }
        }
      }, this._getRandomLatency());
    }
  }
  
  /**
   * Closes the simulated WebSocket
   */
  close(code?: number, reason?: string): void {
    if (this._isClosed) return;
    
    this.readyState = MockWebSocket.CLOSING;
    
    // Simulate connection close latency
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this._isConnected = false;
      this._isClosed = true;
      
      // Trigger close event
      this._triggerClose(code || 1000, reason || 'Normal closure');
      
      // Clean up resources
      this._cleanUp();
      
      // If we have an original WebSocket, close it
      if (this._originalWebSocket) {
        this._originalWebSocket.close(code, reason);
      }
    }, this._getRandomLatency());
  }
  
  /**
   * Adds an event listener
   */
  addEventListener(type: string, listener: EventCallback): void {
    if (!this._eventListeners[type]) {
      this._eventListeners[type] = [];
    }
    this._eventListeners[type].push(listener);
  }
  
  /**
   * Removes an event listener
   */
  removeEventListener(type: string, listener: EventCallback): void {
    if (!this._eventListeners[type]) return;
    
    const index = this._eventListeners[type].indexOf(listener);
    if (index !== -1) {
      this._eventListeners[type].splice(index, 1);
    }
  }
  
  /**
   * Dispatches an event
   */
  dispatchEvent(event: Event): boolean {
    const type = event.type;
    
    // Call the specific handler if it exists
    switch (type) {
      case 'open':
        if (this.onopen) this.onopen.call(this, event);
        break;
      case 'message':
        if (this.onmessage) this.onmessage.call(this, event as MessageEvent);
        break;
      case 'error':
        if (this.onerror) this.onerror.call(this, event);
        break;
      case 'close':
        if (this.onclose) this.onclose.call(this, event as CloseEvent);
        break;
    }
    
    // Call listeners
    if (this._eventListeners[type]) {
      for (const listener of this._eventListeners[type]) {
        listener.call(this, event);
      }
    }
    
    return true;
  }
  
  /**
   * Gets a random latency value within the configured range
   */
  private _getRandomLatency(): number {
    return this._conditions.latencyMin + 
      Math.random() * (this._conditions.latencyMax - this._conditions.latencyMin);
  }
  
  /**
   * Schedules a random disconnection based on the disconnect rate
   */
  private _scheduleRandomDisconnect(): void {
    if (this._isClosed) return;
    
    // Calculate when to check for disconnection (roughly every second)
    const checkInterval = 1000;
    
    setTimeout(() => {
      // Check if we should disconnect
      if (Math.random() < this._conditions.disconnectRate && this._isConnected) {
        console.log('[NetworkSimulator] Random disconnection');
        
        // Simulate error and disconnect
        this._triggerError(new Error('Connection lost'));
        this.readyState = MockWebSocket.CLOSED;
        this._isConnected = false;
        this._triggerClose(1001, 'Connection lost');
        
        // Simulate reconnection after delay if specified
        if (this._conditions.reconnectDelay > 0) {
          setTimeout(() => {
            console.log('[NetworkSimulator] Attempting reconnection');
            this.readyState = MockWebSocket.CONNECTING;
            this._isConnecting = true;
            this._isClosed = false;
            this._connect();
          }, this._conditions.reconnectDelay);
        }
      }
      
      // Schedule next check if still connected
      if (!this._isClosed) {
        this._scheduleRandomDisconnect();
      }
    }, checkInterval);
  }
  
  /**
   * Initializes bandwidth control
   */
  private _initBandwidthControl(): void {
    // Clear any existing interval
    if (this._bandwidthInterval !== null) {
      clearInterval(this._bandwidthInterval);
    }
    
    // Set up bandwidth control (check every 100ms)
    this._bandwidthInterval = setInterval(() => {
      this._sendBuffer = 0; // Reset the buffer every interval
    }, 100) as unknown as number;
  }
  
  /**
   * Adds data to the bandwidth buffer and throttles if needed
   */
  private _addToBandwidthBuffer(bytes: number): void {
    this._sendBuffer += bytes;
    
    // Calculate how much bandwidth we're allowed per 100ms
    const bytesPerInterval = this._conditions.bandwidth / 10;
    
    // If we've exceeded our bandwidth, delay the next send
    if (this._sendBuffer > bytesPerInterval) {
      const excessFactor = this._sendBuffer / bytesPerInterval;
      const delayMs = 100 * excessFactor;
      
      // Clear any existing timeout
      if (this._bandwidthThrottleTimeout !== null) {
        clearTimeout(this._bandwidthThrottleTimeout);
      }
      
      // Set a new timeout to allow sending again
      this._bandwidthThrottleTimeout = setTimeout(() => {
        this._sendBuffer = 0;
      }, delayMs);
    }
  }
  
  /**
   * Triggers open event
   */
  private _triggerOpen(): void {
    const event = new Event('open');
    this.dispatchEvent(event);
  }
  
  /**
   * Triggers message event
   */
  private _triggerMessage(data: any): void {
    const event = new MessageEvent('message', { data });
    this.dispatchEvent(event);
  }
  
  /**
   * Triggers error event
   */
  private _triggerError(error: Error): void {
    const event = new ErrorEvent('error', { error });
    this.dispatchEvent(event as Event);
  }
  
  /**
   * Triggers close event
   */
  private _triggerClose(code: number, reason: string): void {
    const event = new CloseEvent('close', { code, reason, wasClean: code === 1000 });
    this.dispatchEvent(event);
  }
  
  /**
   * Cleans up resources
   */
  private _cleanUp(): void {
    // Clear bandwidth control interval
    if (this._bandwidthInterval !== null) {
      clearInterval(this._bandwidthInterval);
      this._bandwidthInterval = null;
    }
    
    // Clear bandwidth throttle timeout
    if (this._bandwidthThrottleTimeout !== null) {
      clearTimeout(this._bandwidthThrottleTimeout);
      this._bandwidthThrottleTimeout = null;
    }
    
    // Clear event listeners
    for (const type in this._eventListeners) {
      this._eventListeners[type] = [];
    }
  }
}

/**
 * Network Simulator that replaces the global WebSocket with a mock
 */
export class NetworkSimulator {
  private originalWebSocket: typeof WebSocket;
  private condition: NetworkCondition;
  private isActive: boolean;
  
  constructor() {
    this.originalWebSocket = window.WebSocket;
    this.condition = NetworkConditions.PERFECT;
    this.isActive = false;
  }
  
  /**
   * Enables network simulation with the specified condition
   */
  enable(condition: NetworkCondition = NetworkConditions.AVERAGE): void {
    if (this.isActive) {
      this.disable();
    }
    
    this.condition = condition;
    this.isActive = true;
    
    // Replace global WebSocket with our mock
    (window as any).WebSocket = (url: string, protocols?: string | string[]) => {
      return this.createMockWebSocket(url, protocols);
    };
    
    console.log('[NetworkSimulator] Enabled with conditions:', this.condition);
  }
  
  /**
   * Disables network simulation and restores original WebSocket
   */
  disable(): void {
    if (!this.isActive) return;
    
    // Restore original WebSocket
    window.WebSocket = this.originalWebSocket;
    this.isActive = false;
    
    console.log('[NetworkSimulator] Disabled');
  }
  
  /**
   * Sets the network condition while keeping simulation active
   */
  setCondition(condition: NetworkCondition): void {
    this.condition = condition;
    console.log('[NetworkSimulator] Updated conditions:', this.condition);
  }
  
  /**
   * Gets the current network condition
   */
  getCondition(): NetworkCondition {
    return {...this.condition};
  }
  
  /**
   * Creates a mock WebSocket with the current network conditions
   */
  private createMockWebSocket(url: string, protocols?: string | string[]): MockWebSocket {
    return new MockWebSocket(url, protocols, this.condition);
  }
}

// Export singleton instance
export default new NetworkSimulator(); 