import { ApprovalsService } from '../../src/services/approvals';
import type { UserContext } from '../../src/types';

describe('ApprovalsService', () => {
  const logger = { info: jest.fn() };
  const service = new ApprovalsService(logger);
  const user: UserContext = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Requester',
    tenantId: 'tenant',
  };

  it('creates access requests with idempotency', () => {
    const payload = {
      resource: 'Database',
      justification: 'Need read access',
      approverId: '22222222-2222-4222-8222-222222222222',
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
    };

    const first = service.createRequest(payload, user);
    const second = service.createRequest(payload, user);

    expect(first.id).toEqual(second.id);
    expect(first.resource).toEqual('Database');
    expect(logger.info).toHaveBeenCalled();
  });

  it('records approval decisions', () => {
    const payload = {
      resource: 'Storage',
      justification: 'Need write access',
      approverId: '44444444-4444-4444-8444-444444444444',
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
    };

    const request = service.createRequest(payload, user);

    const decision = service.recordDecision({
      requestId: request.id,
      approverId: payload.approverId,
      decision: 'approved',
      comment: 'Looks good',
    });

    expect(decision.status).toEqual('approved');
    expect(decision.approverComment).toEqual('Looks good');
  });
});
