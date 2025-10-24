import { randomUUID } from 'crypto';

import Joi from 'joi';

import type { AccessRequest, ApprovalDecision, IdempotencyRecord, UserContext } from '../types';

export interface CreateRequestInput {
  resource: string;
  justification: string;
  approverId: string;
  idempotencyKey: string;
}

const createRequestSchema = Joi.object<CreateRequestInput>({
  resource: Joi.string().max(120).required(),
  justification: Joi.string().max(2048).required(),
  approverId: Joi.string().guid({ version: 'uuidv4' }).required(),
  idempotencyKey: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

const decisionSchema = Joi.object<ApprovalDecision>({
  requestId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  approverId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  decision: Joi.string().valid('approved', 'rejected').required(),
  comment: Joi.string().max(1024).allow('', null),
});

type RequestStore = Map<string, AccessRequest>;
type IdempotencyStore = Map<string, IdempotencyRecord>;

export class ApprovalsService {
  private readonly requests: RequestStore = new Map();
  private readonly idempotency: IdempotencyStore = new Map();

  constructor(private readonly logger: { info: (msg: string, meta?: Record<string, unknown>) => void }) {}

  createRequest(input: CreateRequestInput, user: UserContext): AccessRequest {
    const { value, error } = createRequestSchema.validate(input, { abortEarly: false, stripUnknown: true });
    if (error) {
      throw new Error(`Invalid create request payload: ${error.message}`);
    }

    const existingKey = this.idempotency.get(value.idempotencyKey);
    if (existingKey) {
      const existingRequest = this.requests.get(existingKey.requestId);
      if (!existingRequest) {
        throw new Error('Idempotency record exists without backing request');
      }

      this.logger.info('Idempotent create request', { requestId: existingRequest.id });
      return existingRequest;
    }

    const now = new Date().toISOString();
    const accessRequest: AccessRequest = {
      id: randomUUID(),
      resource: value.resource,
      justification: value.justification,
      requesterId: user.id,
      requesterName: user.name,
      approverId: value.approverId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.requests.set(accessRequest.id, accessRequest);
    this.idempotency.set(value.idempotencyKey, {
      key: value.idempotencyKey,
      requestId: accessRequest.id,
      createdAt: now,
    });

    this.logger.info('Access request created', { requestId: accessRequest.id });
    return accessRequest;
  }

  getRequestsByRequester(requesterId: string): AccessRequest[] {
    return [...this.requests.values()].filter((request) => request.requesterId === requesterId);
  }

  getRequestsByApprover(approverId: string): AccessRequest[] {
    return [...this.requests.values()].filter((request) => request.approverId === approverId);
  }

  getPendingApprovals(approverId: string): AccessRequest[] {
    return this.getRequestsByApprover(approverId).filter((request) => request.status === 'pending');
  }

  getRequestById(requestId: string): AccessRequest | undefined {
    return this.requests.get(requestId);
  }

  recordDecision(decision: ApprovalDecision): AccessRequest {
    const { value, error } = decisionSchema.validate(decision, { abortEarly: false, stripUnknown: true });
    if (error) {
      throw new Error(`Invalid decision payload: ${error.message}`);
    }

    const existing = this.requests.get(value.requestId);
    if (!existing) {
      throw new Error('Request not found');
    }

    if (existing.approverId !== value.approverId) {
      throw new Error('Approver mismatch');
    }

    if (existing.status !== 'pending') {
      throw new Error('Request has already been completed');
    }

    const updated: AccessRequest = {
      ...existing,
      status: value.decision,
      updatedAt: new Date().toISOString(),
      approverComment: value.comment ?? undefined,
    };

    this.requests.set(updated.id, updated);
    this.logger.info('Approval decision recorded', { requestId: updated.id, decision: updated.status });
    return updated;
  }
}
