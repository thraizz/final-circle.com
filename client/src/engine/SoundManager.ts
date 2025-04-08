import * as THREE from 'three';

export class SoundManager {
  private static instance: SoundManager;
  private audioListener: THREE.AudioListener;
  private sounds: Map<string, THREE.Audio>;
  private soundLoader: THREE.AudioLoader;

  private constructor() {
    this.audioListener = new THREE.AudioListener();
    this.sounds = new Map();
    this.soundLoader = new THREE.AudioLoader();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public initialize(camera: THREE.Camera): void {
    camera.add(this.audioListener);
  }

  public loadSound(name: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.soundLoader.load(
        path,
        (buffer) => {
          const sound = new THREE.Audio(this.audioListener);
          sound.setBuffer(buffer);
          this.sounds.set(name, sound);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`Error loading sound ${name}:`, error);
          reject(error);
        }
      );
    });
  }

  public playSound(name: string, volume: number = 1.0): void {
    const sound = this.sounds.get(name);
    if (sound) {
      if (sound.isPlaying) {
        sound.stop();
      }
      sound.setVolume(volume);
      sound.play();
    }
  }

  public stopSound(name: string): void {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.stop();
    }
  }

  public cleanup(): void {
    this.sounds.forEach(sound => sound.stop());
    this.sounds.clear();
  }
} 