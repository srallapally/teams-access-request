import express from 'express';
import Joi from 'joi';

const router = express.Router();

const decisionSchema = Joi.object({
  requestId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  decision: Joi.string().valid('approved', 'rejected').required(),
  comment: Joi.string().max(1024).allow('', null),
  externalToken: Joi.string().optional(),
});

router.get('/pending', (req, res) => {
  const services = res.locals.services as any;
  const userContext = res.locals.userContext;

  const pending = services.approvalsService.getPendingApprovals(userContext.id);
  res.json({ data: pending });
});

router.post('/decision', async (req, res) => {
  const { value, error } = decisionSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const services = res.locals.services as any;
  const userContext = res.locals.userContext;

  try {
    const updated = services.approvalsService.recordDecision({
      requestId: value.requestId,
      approverId: userContext.id,
      decision: value.decision,
      comment: value.comment,
    });

    if (value.externalToken) {
      await services.externalApi.sendDecision({
        requestId: updated.id,
        approverId: userContext.id,
        decision: updated.status,
        token: value.externalToken,
      });
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, 'Failed to record decision');
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
