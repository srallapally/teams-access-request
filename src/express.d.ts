import type { Logger } from 'pino';
import type { UserContext } from './types';

declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
      userAssertion?: string;
      log: Logger;
    }
  }
}

export {};
