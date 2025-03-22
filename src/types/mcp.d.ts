declare module '@modelcontextprotocol/sdk/server/index.js' {
  export class Server {
    constructor(info: any, config: any);
    onerror: (error: Error) => void;
    close(): Promise<void>;
    connect(transport: any): Promise<void>;
    setRequestHandler(schema: any, handler: Function): void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
  }
}

declare module '@modelcontextprotocol/sdk/types.js' {
  export const CallToolRequestSchema: any;
  export const ListToolsRequestSchema: any;
  export const ErrorCode: {
    MethodNotFound: string;
  };
  export class McpError extends Error {
    constructor(code: string, message: string);
  }
}
