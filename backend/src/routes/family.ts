import { Router } from 'express';
import { z } from '@wonderlab/shared';
import { authenticate, requireRoles } from '../auth.js';
import {
  plans,
  learningAccess,
  heartbeat,
  parentDashboard,
  createChild,
  updateChild,
  resetPasscode,
  childProgress,
  billing,
  requestSubscription,
  cancelSubscription,
  listPlans,
  savePlan,
  listFamilies,
  familyDashboard,
  updateFamily,
  listSubscriptions,
  createSubscription,
} from '../services/family.js';
export const familyRouter = Router();
familyRouter.get('/plans', async (_req, res) => res.json(await plans()));
familyRouter.use(authenticate);
familyRouter.get('/learning-access', async (req, res) => res.json(await learningAccess(req.user!)));
familyRouter.post('/learning-heartbeat', async (req, res) =>
  res.json(await heartbeat(req.user!, req.body)),
);
familyRouter.get('/parent/dashboard', async (req, res) =>
  res.json(await parentDashboard(req.user!)),
);
familyRouter.get('/parent/billing', async (req, res) => res.json(await billing(req.user!)));
familyRouter.post('/parent/children', async (req, res) =>
  res.status(201).json(await createChild(req.user!, req.body)),
);
familyRouter.patch('/parent/children/:id', async (req, res) =>
  res.json(await updateChild(req.user!, String(req.params.id), req.body)),
);
familyRouter.post('/parent/children/:id/passcode', async (req, res) =>
  res.json(await resetPasscode(req.user!, String(req.params.id), req.body)),
);
familyRouter.get('/parent/children/:id/progress', async (req, res) =>
  res.json(await childProgress(req.user!, String(req.params.id))),
);
familyRouter.post('/parent/subscriptions', async (req, res) =>
  res.status(201).json(await requestSubscription(req.user!, req.body)),
);
familyRouter.post('/parent/subscriptions/:id/cancel', async (req, res) =>
  res.json(await cancelSubscription(String(req.params.id), req.user!)),
);
export const familyAdminRouter = Router();
familyAdminRouter.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'));
familyAdminRouter.get('/plans', async (req, res) => res.json(await listPlans(req.query)));
familyAdminRouter.post('/plans', async (req, res) =>
  res.status(201).json(await savePlan(req.body)),
);
familyAdminRouter.patch('/plans/:id', async (req, res) =>
  res.json(await savePlan(req.body, String(req.params.id))),
);
familyAdminRouter.get('/families', async (req, res) => res.json(await listFamilies(req.query)));
familyAdminRouter.get('/families/:id', async (req, res) =>
  res.json(await familyDashboard(String(req.params.id))),
);
familyAdminRouter.patch('/families/:id', async (req, res) =>
  res.json(await updateFamily(String(req.params.id), req.body)),
);
familyAdminRouter.get('/subscriptions', async (req, res) =>
  res.json(await listSubscriptions(req.query)),
);
familyAdminRouter.post('/subscriptions', async (req, res) => {
  const input = z
    .strictObject({
      familyId: z.uuid(),
      planId: z.uuid(),
      periodDays: z.number().int().min(1).max(365),
    })
    .parse(req.body);
  res.status(201).json(await createSubscription(input.familyId, input.planId, input.periodDays));
});
familyAdminRouter.patch('/subscriptions/:id', async (req, res) => {
  z.strictObject({ status: z.literal('CANCELLED') }).parse(req.body);
  res.json(await cancelSubscription(String(req.params.id)));
});
