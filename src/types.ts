export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  resource: string;
  justification: string;
  requesterId: string;
  requesterName: string;
  approverId: string;
  status: AccessRequestStatus;
  createdAt: string;
  updatedAt: string;
  approverComment?: string;
}

export interface ApprovalDecision {
  requestId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}

export interface UserContext {
  id: string;
  name: string;
  email?: string;
  tenantId: string;
  roles?: string[];
}

export interface IdempotencyRecord {
  key: string;
  requestId: string;
  createdAt: string;
}
