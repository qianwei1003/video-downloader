import { IPlatform } from './IPlatform';

export abstract class PlatformFactory {
  abstract createPlatform(): IPlatform;
  abstract getPlatformName(): string;
  abstract matchUrl(url: string): boolean;
}

export class PlatformRegistry {
  private static instance: PlatformRegistry;
  private factories: Map<string, PlatformFactory>;

  private constructor() {
    this.factories = new Map();
  }

  static getInstance(): PlatformRegistry {
    if (!PlatformRegistry.instance) {
      PlatformRegistry.instance = new PlatformRegistry();
    }
    return PlatformRegistry.instance;
  }

  registerFactory(factory: PlatformFactory): void {
    const name = factory.getPlatformName();
    if (this.factories.has(name)) {
      throw new Error(`平台 ${name} 已经注册`);
    }
    this.factories.set(name, factory);
  }

  createPlatform(url: string): IPlatform | null {
    for (const factory of this.factories.values()) {
      if (factory.matchUrl(url)) {
        return factory.createPlatform();
      }
    }
    return null;
  }

  getPlatformFactory(name: string): PlatformFactory | undefined {
    return this.factories.get(name);
  }

  getAllPlatformNames(): string[] {
    return Array.from(this.factories.keys());
  }
}
