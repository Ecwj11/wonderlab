import { Router } from 'express';
import { authenticate, requireRoles } from '../auth.js';
import {
  getParentRewards,
  saveRewardRules,
  saveReward,
  listRewards,
  getStarWallet,
  listStarTransactions,
  listRedemptions,
  redeemReward,
  decideRedemption,
  cancelRedemption,
} from '../services/rewards.js';
export const rewardsRouter = Router();
rewardsRouter.use('/rewards', authenticate);
rewardsRouter.use('/parent/rewards', authenticate, requireRoles('PARENT'));
rewardsRouter.get('/parent/rewards/dashboard', async (req, res) =>
  res.json(await getParentRewards(req.user!)),
);
rewardsRouter.put('/parent/rewards/settings', async (req, res) =>
  res.json(await saveRewardRules(req.user!, req.body)),
);
rewardsRouter.get('/parent/rewards/redemptions', async (req, res) =>
  res.json(await listRedemptions(req.user!, req.query, true)),
);
rewardsRouter.patch('/parent/rewards/redemptions/:id', async (req, res) =>
  res.json(await decideRedemption(req.user!, String(req.params.id), req.body)),
);
rewardsRouter.get('/parent/rewards', async (req, res) =>
  res.json(await listRewards(req.user!, req.query, true)),
);
rewardsRouter.post('/parent/rewards', async (req, res) =>
  res.status(201).json(await saveReward(req.user!, req.body)),
);
rewardsRouter.patch('/parent/rewards/:id', async (req, res) =>
  res.json(await saveReward(req.user!, req.body, String(req.params.id))),
);
rewardsRouter.get('/rewards/wallet', async (req, res) => res.json(await getStarWallet(req.user!)));
rewardsRouter.get('/rewards/transactions', async (req, res) =>
  res.json(await listStarTransactions(req.user!, req.query)),
);
rewardsRouter.get('/rewards/redemptions', async (req, res) =>
  res.json(await listRedemptions(req.user!, req.query)),
);
rewardsRouter.post('/rewards/redemptions/:id/cancel', async (req, res) =>
  res.json(await cancelRedemption(req.user!, String(req.params.id), req.body)),
);
rewardsRouter.get('/rewards', async (req, res) =>
  res.json(await listRewards(req.user!, req.query)),
);
rewardsRouter.post('/rewards/:id/redeem', async (req, res) =>
  res.status(201).json(await redeemReward(req.user!, String(req.params.id), req.body)),
);
