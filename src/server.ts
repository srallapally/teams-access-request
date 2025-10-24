import { randomUUID } from 'crypto';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import csrf from 'csurf';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt, { JwtPayload } from 'jsonwebtoken';
import pino from 'pino';
import pinoHttp from 'pino-http';
import path from 'path';

import { sendActivityNotification } from './notifications/activityFeed';
import approvalsRouter from './routes/approvals';
import requestsRouter from './routes/requests';
import { ApprovalsService } from './services/approvals';
import { ExternalApprovalApi } from './services/externalApprovalApi';
import { GraphClientFactory } from './services/graphClient';
import type { UserContext } from './types';

dotenv.config();

const requiredEnv = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'GRAPH_SCOPES', 'BASE_URL', 'SESSION_SECRET'];
for (const variable of requiredEnv) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const app = express();

const graphScopes = process.env.GRAPH_SCOPES?.split(/\s+/).filter(Boolean) ?? ['User.Read', 'TeamsActivity.Send'];

const graphClientFactory = new GraphClientFactory({
  tenantId: process.env.TENANT_ID!,
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  authorityHost: process.env.AUTHORITY_HOST,
  scopes: graphScopes,
});

const approvalsService = new ApprovalsService({
  info: (msg, meta) => logger.info(meta ?? {}, msg),
});

const externalApi = new ExternalApprovalApi({
  baseUrl: process.env.OPTIONAL_EXTERNAL_API_BASE_URL,
});

const csrfProtection = csrf({
  cookie: {
    key: 'csrfToken',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  },
});

const requestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());

const staticRoot = path.join(__dirname, '../public');
app.use('/tab', express.static(path.join(staticRoot, 'tab')));
app.use('/taskModules', express.static(path.join(staticRoot, 'taskModules')));
app.use('/assets', express.static(__dirname));
app.use(
  cors({
    origin: [process.env.BASE_URL!],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(requestLimiter);

const httpLogger = pinoHttp({
  logger: logger as any,
  customLogLevel: (_req: express.Request, res: express.Response, err: Error | undefined) => {
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
} as any);

app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;
  next();
});

app.use(httpLogger as any);

function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring('Bearer '.length);
  let decoded: JwtPayload | string | null;
  try {
    decoded = jwt.decode(token, { json: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to decode token');
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!decoded || typeof decoded === 'string') {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  const user: UserContext = {
    id: (decoded.oid as string) ?? (decoded.sub as string),
    name: (decoded.name as string) ?? 'Unknown User',
    email: decoded.preferred_username as string | undefined,
    tenantId: (decoded.tid as string) ?? process.env.TENANT_ID!,
    roles: (decoded.roles as string[]) ?? undefined,
  };

  req.userContext = user;
  req.userAssertion = token;
  next();
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.use('/api', authenticateUser, csrfProtection, (req, res, next) => {
  if (!req.userContext || !req.userAssertion) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.locals.services = {
    approvalsService,
    graphClientFactory,
    externalApi,
    sendActivityNotification,
  };

  res.locals.userContext = req.userContext;
  res.locals.userAssertion = req.userAssertion;
  next();
});

app.use('/api/requests', requestsRouter);
app.use('/api/approvals', approvalsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = Number(process.env.PORT ?? 3978);

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
  });
}

export default app;
