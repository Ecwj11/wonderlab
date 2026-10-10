import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from '@wonderlab/shared';
import { rows, run, transaction, pool } from './pool.js';
const inputSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(14).max(128),
});
export async function bootstrapAdmin(payload: unknown) {
  const input = inputSchema.parse(payload);
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  await transaction(async (db) => {
    const [role] = await rows("SELECT id FROM roles WHERE id='SUPER_ADMIN' FOR UPDATE", [], db);
    if (!role) throw new Error('Apply database migrations before provisioning an administrator.');
    if (
      (await rows("SELECT user_id FROM user_roles WHERE role_id='SUPER_ADMIN' LIMIT 1", [], db))
        .length
    )
      throw new Error('A super administrator already exists. Use their account to manage roles.');
    await run(
      'INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',
      [id, input.name, input.email, passwordHash],
      db,
    );
    await run("INSERT INTO user_roles(user_id,role_id) VALUES(?,'SUPER_ADMIN')", [id], db);
  });
  return { id, email: input.email };
}
if (
  process.argv[1]?.endsWith('bootstrap-admin.ts') ||
  process.argv[1]?.endsWith('bootstrap-admin.js')
) {
  bootstrapAdmin({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  })
    .then((result) => console.log('Provisioned first super administrator:', result.email))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Provisioning failed');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
