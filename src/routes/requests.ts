import express from 'express';
import Joi from 'joi';

import type { AccessRequest } from '../types';

const router = express.Router();

const createSchema = Joi.object({
  resource: Joi.string().max(120).required(),
  justification: Joi.string().max(2048).required(),
  approverId: Joi.string().guid({ version: 'uuidv4' }).required(),
  idempotencyKey: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

router.post('/', async (req, res) => {
  if (!req.body.idempotencyKey && req.headers['idempotency-key']) {
    const headerKey = req.headers['idempotency-key'];
    req.body.idempotencyKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
  }

  const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const services = res.locals.services as any;
  const userContext = res.locals.userContext;
  const userAssertion = res.locals.userAssertion as string;

  try {
    const accessRequest: AccessRequest = services.approvalsService.createRequest(value, userContext);

    const graphClient = services.graphClientFactory.getClient(userContext, userAssertion);
    const taskModuleUrl = `${process.env.BASE_URL}/taskModules/approve.html?requestId=${accessRequest.id}`;
    const deepLinkContext = encodeURIComponent(
      JSON.stringify({
        subEntityId: accessRequest.id,
        url: taskModuleUrl,
        title: 'Approve access request',
      }),
    );
    const deepLink = `https://teams.microsoft.com/l/task/${process.env.CLIENT_ID}/${accessRequest.id}?context=${deepLinkContext}`;

    await services.sendActivityNotification(graphClient, {
      requestId: accessRequest.id,
      approverAadId: accessRequest.approverId,
      title: `Approval needed for ${accessRequest.resource}`,
      description: `${userContext.name} requested access`,
      deepLink,
    });

    res.status(201).json(accessRequest);
  } catch (err) {
    req.log.error({ err }, 'Failed to create request');
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/mine', (req, res) => {
  const services = res.locals.services as any;
  const userContext = res.locals.userContext;

  const requests = services.approvalsService.getRequestsByRequester(userContext.id);
  res.json({ data: requests });
});

router.get('/approvals', (req, res) => {
  const services = res.locals.services as any;
  const userContext = res.locals.userContext;

  const approvals = services.approvalsService.getRequestsByApprover(userContext.id);
  res.json({ data: approvals });
});

router.get('/:id', (req, res) => {
  const services = res.locals.services as any;
  const request = services.approvalsService.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(request);
});

export default router;
