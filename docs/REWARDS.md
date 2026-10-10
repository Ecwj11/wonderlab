# Family prizes and Stars

XP already drives learning levels and achievements. Family prizes use a separate Stars wallet. Spending or refunding Stars never changes XP. Parents create actual prizes or experiences (for example, an ice cream outing, a book or family movie night); this feature records requests and delivery, not purchases or payments.

## Agreed implementation

- `/parent/rewards`: manage prizes and their positive integer star cost, choose all children or one child, enable/pause prizes, configure earning rules and review redemption requests. Default learning awards: 5 Stars per completed lesson, 1 per correct quiz answer, plus 5 for a perfect quiz. Rules affect future awards and may be set to zero individually.
- `/app/rewards`: colourful prize shelf, spendable balance, earning guidance, confirmation before redeeming, redemption history and star transaction history. A child can cancel a pending request.
- Stars are awarded by the same validated server-side learning transaction that awards XP. Completing or replaying an already rewarded lesson/quiz cannot award Stars again. Prior child learning XP transactions are converted once at the default rate (1 Star per 10 XP) during migration; manually seeded XP without a learning transaction is excluded.
- Redeeming immediately reserves/debits the snapshotted cost and creates a PENDING request. The parent marks it FULFILLED after giving the prize, or DECLINED to return Stars. Child cancellation also refunds exactly once. Each child can have one pending request per prize. Final states cannot be reversed. Prize edits never change an existing request's name or cost.
- Wallet locks and unique transaction/request keys protect against overspending and repeated clicks/retries. Request IDs are scoped to a child, immutable and bound to one prize.
- Prizes, settings and child data are family-scoped. Children cannot edit earning rules or costs, see a sibling's private prize, or change another child's request. Rewards remain accessible when a trial or daily learning allowance ends, since they were already earned; suspended child/family/parent accounts cannot make new requests.
- Active children can sign in and refresh their session after trial expiry or daily exhaustion to access earned prizes. Learning endpoints still enforce entitlement and time limits. Redemption rechecks account and membership status using locking current reads after acquiring the wallet, so a pause committed while waiting is respected.
- Browser request IDs survive a lost response. A replay of an already resolved request displays its final outcome without spending again; starting another request always requires a fresh confirmation. Pagination remains navigable if a request list shrinks after a parent decision.

## Storage

Migration `009_family_rewards.sql` adds relational tables: `family_reward_settings`, `family_rewards`, `child_star_wallets`, `reward_redemptions`, `child_star_transactions`. Indexed family/child/status/date fields support catalogues and histories. An append-only star ledger has a unique source key per child; balance and lifetime earnings are updated atomically with it. Prizes are paused instead of deleted so requests retain their audit trail.

## API contract

Browser calls always use `/api` through the existing Next proxy. Below paths are backend routes. All list endpoints use the existing `{data,page,pageSize,total,totalPages}` shape (default pageSize 20, max 100).

| Method | Route                             | Result / request                                                                 |
| ------ | --------------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/parent/rewards/dashboard`       | `ParentRewardsDashboard`: earning `rules`, children with balances                |
| GET    | `/parent/rewards`                 | Paginated `FamilyReward`, optional `childId` filter                              |
| POST   | `/parent/rewards`                 | `RewardInput` -> 201 `FamilyReward`                                              |
| PATCH  | `/parent/rewards/:id`             | Full `RewardInput` -> `FamilyReward`                                             |
| PUT    | `/parent/rewards/settings`        | `RewardRules` -> `RewardRules`                                                   |
| GET    | `/parent/rewards/redemptions`     | Paginated `RewardRedemption`, optional `status` / `childId`                      |
| PATCH  | `/parent/rewards/redemptions/:id` | `{status:'FULFILLED'                                                             | 'DECLINED',note?:string}`->`RewardRedemption` |
| GET    | `/rewards/wallet`                 | Child's `StarWallet`                                                             |
| GET    | `/rewards`                        | Paginated active prizes for this child                                           |
| POST   | `/rewards/:id/redeem`             | `{requestId:UUID}` -> 201 `RewardRedemption` (same key returns original request) |
| GET    | `/rewards/redemptions`            | Child's paginated requests                                                       |
| POST   | `/rewards/redemptions/:id/cancel` | Empty object -> `RewardRedemption`                                               |
| GET    | `/rewards/transactions`           | Child's paginated `StarTransaction` history                                      |

Contracts and validation live in `shared/src/rewards.ts`. Family rewards are real data; no fake balance or arbitrary client-controlled award endpoint is provided.

## Verification plan

Integration tests cover ownership/RBAC, payload validation, default/custom earnings, award and request idempotency, concurrent overspending, snapshots, fulfilment, refunds and final-state transitions. Browser tests cover a parent creating a prize and earning rules, a child earning Stars by completing a real lesson and requesting that prize, parent delivery/decline, mobile layout and Chinese/bilingual controls. Run TypeScript, lint, the full test suite and production build before completion.

## Illustrated demo prizes

Run `npm run db:seed-rewards -w backend` after migrations and family seeding to add a storybook (20 Stars), family meal (40 Stars), and toy set (60 Stars) to WONDER01. Stable IDs prevent duplicates and preserve edits. No currency or prizes are added to other families. Family seeding also includes these prizes.

`imageKey` is nullable and restricted to the bundled storybook, family-meal, and toy-set catalogue. Parents can choose a picture or use an emoji. Migration 010 stores the catalogue key on prizes and redemption snapshots, so editing the prize does not change pending requests.

Illustrations were created using the built-in image generator. Prompt set: centered playful storybooks on lavender, a Malaysian family rice-and-chicken meal on peach, and a teddy bear with building blocks and a wooden toy car on mint; soft rounded clay illustration, no text or branding. Assets live in `frontend/public/images/rewards/`.
