declare global {
  interface Window {
    __APP_CONFIG__?: {
      resourceId?: string;
      externalApiBaseUrl?: string;
    };
  }
}

export {};
