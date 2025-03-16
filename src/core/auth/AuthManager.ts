import { Logger } from '@lib/logger';
import { IAuth, AuthCredentials, AuthResult } from './IAuth';

export class AuthManager {
  private static instance: AuthManager;
  private logger: Logger;
  private authProviders: Map<string, IAuth>;
  private credentials: Map<string, AuthCredentials>;

  private constructor() {
    this.logger = new Logger();
    this.authProviders = new Map();
    this.credentials = new Map();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  registerAuthProvider(platformName: string, provider: IAuth): void {
    if (this.authProviders.has(platformName)) {
      throw new Error(`认证提供器已存在: ${platformName}`);
    }
    this.authProviders.set(platformName, provider);
  }

  async isAuthRequired(platformName: string, url: string): Promise<boolean> {
    const provider = this.authProviders.get(platformName);
    if (!provider) {
      return false;
    }
    return provider.isAuthRequired(url);
  }

  async authenticate(platformName: string, credentials: AuthCredentials): Promise<AuthResult> {
    const provider = this.authProviders.get(platformName);
    if (!provider) {
      return {
        success: false,
        error: `未找到平台的认证提供器: ${platformName}`
      };
    }

    try {
      const result = await provider.authenticate(credentials);
      if (result.success && result.credentials) {
        this.credentials.set(platformName, result.credentials);
      }
      return result;
    } catch (error) {
      this.logger.error(`认证失败 ${platformName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '认证过程发生错误'
      };
    }
  }

  hasAuthProvider(platformName: string): boolean {
    return this.authProviders.has(platformName);
  }

  getCredentials(platformName: string): AuthCredentials | null {
    const provider = this.authProviders.get(platformName);
    if (!provider) {
      return null;
    }
    return provider.getCredentials();
  }

  clearCredentials(platformName: string): void {
    const provider = this.authProviders.get(platformName);
    if (provider) {
      provider.clearCredentials();
      this.credentials.delete(platformName);
    }
  }
}
