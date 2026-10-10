import { randomBytes, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z, type User, type Role } from '@wonderlab/shared';
import { config } from './config.js';
import { rows, run, transaction, type Db } from './db/pool.js';
import { ApiError } from './http.js';
import { registerParent, familyForUser, learningAccess } from './services/family.js';
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
interface UserRow {
  id: string;
  name: string;
  email: string;
  status: User['status'];
  xp: number;
  timezone: string;
  created_at: Date;
  password_hash: string;
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function getUser(id: string, db?: Db): Promise<User | null> {
  const [row] = await rows<UserRow>('SELECT * FROM users WHERE id=?', [id], db);
  if (!row) return null;
  const roles = await rows<{ role_id: Role }>(
    'SELECT role_id FROM user_roles WHERE user_id=?',
    [id],
    db,
  );
  const family = await familyForUser(id, db);
  const roleNames = roles.map((r) => r.role_id);
  const accountType = family
    ? family.parent_id === id
      ? 'PARENT'
      : 'CHILD'
    : row.email.endsWith('@child.wonderlab.invalid')
      ? 'CHILD'
      : roleNames.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
        ? 'ADMIN'
        : undefined;
  return {
    ...(accountType ? { accountType } : {}),
    ...(family ? { familyId: family.id } : {}),
    id: row.id,
    name: row.name,
    email: accountType === 'CHILD' ? '' : row.email,
    status: row.status,
    xp: row.xp,
    level: Math.floor(row.xp / 500) + 1,
    timezone: row.timezone,
    createdAt: row.created_at.toISOString(),
    roles: roles.map((r) => r.role_id),
  };
}
export async function tokens(user: User, db?: Db) {
  const credentialVersion =
    user.accountType === 'CHILD' ? await childCredentialVersion(user.id, db) : undefined;
  const refreshToken = randomBytes(48).toString('base64url');
  const accessToken = jwt.sign(
    { sub: user.id, ...(credentialVersion ? { credentialVersion } : {}) },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'wonderlab',
      audience: 'wonderlab-api',
    },
  );
  await run(
    'INSERT INTO refresh_tokens(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',
    [randomUUID(), user.id, hash(refreshToken), new Date(Date.now() + 7 * 86400000)],
    db,
  );
  return { accessToken, refreshToken, user };
}
async function childCredentialVersion(id: string, db?: Db) {
  const [row] = await rows<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id=?',
    [id],
    db,
  );
  return row ? hash(row.password_hash) : null;
}
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'wonderlab',
        audience: 'wonderlab-api',
      }) as jwt.JwtPayload;
    } catch {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in.');
    }
    const user = await getUser(String(payload.sub));
    if (!user || (user.status !== 'ACTIVE' && user.accountType !== 'CHILD'))
      throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'Your account is unavailable.');
    if (
      user.accountType === 'CHILD' &&
      payload.credentialVersion !== (await childCredentialVersion(user.id))
    )
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your passcode changed. Please sign in again.');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.roles.some((role) => roles.includes(role)))
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action.'));
    next();
  };
}
export const authRouter = Router();
const credentials = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
authRouter.post('/login', async (req, res) => {
  const input = credentials.parse(req.body);
  const [row] = await rows<UserRow>('SELECT * FROM users WHERE email=?', [input.email]);
  const valid = await bcrypt.compare(
    input.password,
    row?.password_hash || '$2b$12$5JrskpDoAq3SdS4uPwmiye8lE7P9jjKBwyTLNrKCsXOdrSDDgcL/i',
  );
  if (!row || !valid || row.status !== 'ACTIVE' || (await getUser(row.id))?.accountType === 'CHILD')
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
  await run('UPDATE users SET last_login_at=UTC_TIMESTAMP(3) WHERE id=?', [row.id]);
  res.json(await tokens((await getUser(row.id))!));
});
authRouter.post('/parent/register', async (req, res) =>
  res.status(201).json(await tokens(await registerParent(req.body))),
);
for (const portal of ['admin', 'parent'] as const)
  authRouter.post(`/${portal}/login`, async (req, res) => {
    const input = credentials.parse(req.body);
    const [row] = await rows<UserRow>('SELECT * FROM users WHERE email=?', [input.email]);
    const valid = await bcrypt.compare(
      input.password,
      row?.password_hash || '$2b$12$5JrskpDoAq3SdS4uPwmiye8lE7P9jjKBwyTLNrKCsXOdrSDDgcL/i',
    );
    const user = row ? await getUser(row.id) : null;
    if (
      !row ||
      !valid ||
      row.status !== 'ACTIVE' ||
      user?.accountType !== (portal === 'admin' ? 'ADMIN' : 'PARENT')
    )
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'The email or password is incorrect for this portal.',
      );
    await run('UPDATE users SET last_login_at=UTC_TIMESTAMP(3) WHERE id=?', [row.id]);
    res.json(await tokens(user));
  });
authRouter.post('/child/login', async (req, res) => {
  const input = z
    .strictObject({
      familyCode: z.string().trim().toUpperCase().min(4).max(16),
      username: z.string().trim().toLowerCase().min(3).max(32),
      passcode: z.string().min(1).max(72),
    })
    .parse(req.body);
  const result = await transaction(async (db) => {
    const [row] = await rows<UserRow>(
      'SELECT u.* FROM users u JOIN family_children c ON c.user_id=u.id JOIN families f ON f.id=c.family_id WHERE f.code=? AND c.username=? FOR UPDATE',
      [input.familyCode, input.username],
      db,
    );
    const valid = await bcrypt.compare(
      input.passcode,
      row?.password_hash || '$2b$12$5JrskpDoAq3SdS4uPwmiye8lE7P9jjKBwyTLNrKCsXOdrSDDgcL/i',
    );
    const user = row ? await getUser(row.id, db) : null;
    // Authentication preserves access to already-earned prizes. Learning
    // entitlement and daily time limits are enforced on learning endpoints.
    if (
      !user ||
      !valid ||
      user.status !== 'ACTIVE' ||
      (await learningAccess(user, db)).status === 'SUSPENDED'
    )
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'These child credentials or learning access are unavailable.',
      );
    await run('UPDATE users SET last_login_at=UTC_TIMESTAMP(3) WHERE id=?', [user.id], db);
    return tokens(user, db);
  });
  res.json(result);
});
authRouter.post('/register', async (req, res) => {
  const input = credentials
    .extend({ name: z.string().trim().min(2).max(100), password: z.string().min(10).max(128) })
    .parse(req.body);
  if (input.email.endsWith('@child.wonderlab.invalid'))
    throw new ApiError(400, 'RESERVED_EMAIL', 'Use your own email address.');
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  await transaction(async (db) => {
    await run(
      'INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',
      [id, input.name, input.email, passwordHash],
      db,
    );
    await run("INSERT INTO user_roles(user_id,role_id) VALUES(?,'STUDENT')", [id], db);
  });
  res.status(201).json(await tokens((await getUser(id))!));
});
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = z
    .strictObject({ refreshToken: z.string().min(40).max(200) })
    .parse(req.body);
  const result = await transaction(async (db) => {
    const [row] = await rows<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>('SELECT * FROM refresh_tokens WHERE token_hash=? FOR UPDATE', [hash(refreshToken)], db);
    if (!row || row.revoked_at || row.expires_at.getTime() <= Date.now())
      throw new ApiError(401, 'INVALID_REFRESH', 'Please sign in again.');
    const user = await getUser(row.user_id, db);
    if (!user || user.status !== 'ACTIVE')
      throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'Your account is unavailable.');
    if (user.accountType === 'CHILD') {
      const access = await learningAccess(user, db);
      if (access.status === 'SUSPENDED')
        throw new ApiError(
          401,
          'ACCOUNT_UNAVAILABLE',
          'Your child learning access is unavailable.',
        );
    }
    await run('UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?', [row.id], db);
    return tokens(user, db);
  });
  res.json(result);
});
authRouter.post('/logout', async (req, res) => {
  const { refreshToken } = z.strictObject({ refreshToken: z.string().max(200) }).parse(req.body);
  await run('UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE token_hash=?', [
    hash(refreshToken),
  ]);
  res.status(204).end();
});
authRouter.get('/me', authenticate, (req, res) => res.json(req.user));
authRouter.patch('/me', authenticate, async (req, res) => {
  if (req.user!.accountType === 'CHILD')
    throw new ApiError(
      403,
      'PARENT_CONTROL_REQUIRED',
      'Your parent manages your profile and learning timezone.',
    );
  const input = z
    .strictObject({
      name: z.string().trim().min(2).max(100),
      timezone: z
        .string()
        .max(64)
        .refine((v) => {
          try {
            new Intl.DateTimeFormat('en', { timeZone: v });
            return true;
          } catch {
            return false;
          }
        }, 'Use a valid IANA timezone'),
    })
    .parse(req.body);
  await run('UPDATE users SET name=?,timezone=? WHERE id=?', [
    input.name,
    input.timezone,
    req.user!.id,
  ]);
  res.json(await getUser(req.user!.id));
});
