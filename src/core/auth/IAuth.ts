export interface AuthCredentials {
  cookies?: string;
  token?: string;
  username?: string;
  password?: string;
  [key: string]: any; // 支持其他认证信息
}

export interface AuthResult {
  success: boolean;
  credentials?: AuthCredentials;
  error?: string;
}

export interface IAuth {
  isAuthRequired(url: string): Promise<boolean>;
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  getCredentials(): AuthCredentials | null;
  clearCredentials(): void;
}
