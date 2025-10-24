import { OnBehalfOfCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

import type { UserContext } from '../types';

export interface GraphClientConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  authorityHost?: string;
  scopes: string[];
}

export class GraphClientFactory {
  private readonly cache = new Map<string, Client>();

  constructor(private readonly config: GraphClientConfig) {}

  getClient(user: UserContext, userToken: string): Client {
    const cacheKey = `${user.id}:${[...this.config.scopes].sort().join(',')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const credential = new OnBehalfOfCredential({
      tenantId: this.config.tenantId,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      userAssertionToken: userToken,
      authorityHost: this.config.authorityHost ?? 'https://login.microsoftonline.com',
    });

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken(this.config.scopes);
          if (!token) {
            throw new Error('Unable to acquire Graph token');
          }
          return token.token;
        },
      },
    });

    this.cache.set(cacheKey, client);
    return client;
  }
}

export async function getUserProfile(client: Client) {
  return client.api('/me').get();
}
