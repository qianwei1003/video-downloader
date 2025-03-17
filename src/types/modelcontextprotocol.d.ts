declare module '@modelcontextprotocol/sdk' {
  export class Server {
    constructor(config: McpServerConfig, options: ServerOptions);
    onerror: (error: Error) => void;
    setRequestHandler<T>(schema: SchemaType<T>, handler: RequestHandler<T>): void;
    connect(transport: Transport): Promise<void>;
    close(): Promise<void>;
  }

  export class StdioServerTransport implements Transport {
    async connect(): Promise<void> {
      // Implement connection logic here
    }

    async close(): Promise<void> {
      // Implement closing logic here
    }
  }

  export interface Transport {
    connect(): Promise<void>;
    close(): Promise<void>;
  }

  export interface McpServerConfig {
    name: string;
    version: string;
  }

  export interface ServerOptions {
    capabilities: {
      tools?: Record<string, any>;
      resources?: Record<string, any>;
    };
  }

  export type SchemaType<T> = {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };

  export type RequestHandler<T> = (request: McpRequest<T>) => Promise<McpResponse>;

  export interface McpRequest<T = any> {
    params: {
      name: string;
      arguments: T;
    };
  }

  export interface McpResponse {
    content: Array<{
      type: string;
      text: string;
    }>;
  }

  export enum ErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
  }

  export class McpError extends Error {
    constructor(code: ErrorCode, message: string);
    code: ErrorCode;
  }

  export const CallToolRequestSchema: SchemaType<{
    name: string;
    arguments: any;
  }>;

  export const ListToolsRequestSchema: SchemaType<void>;
}
