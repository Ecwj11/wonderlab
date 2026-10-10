import mysql, {
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2/promise';
import { config } from '../config.js';
const url = new URL(config.DATABASE_URL);
export const pool = mysql.createPool({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 12,
  timezone: 'Z',
  decimalNumbers: true,
  charset: 'utf8mb4',
});
export type Db = typeof pool | PoolConnection;
export async function rows<T>(sql: string, values: unknown[] = [], db: Db = pool): Promise<T[]> {
  const [result] = await db.query<RowDataPacket[]>(sql, values);
  return result as T[];
}
export async function run(sql: string, values: unknown[] = [], db: Db = pool) {
  const [result] = await db.query<ResultSetHeader>(sql, values);
  return result;
}
export async function transaction<T>(work: (db: PoolConnection) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const result = await work(db);
      await db.commit();
      return result;
    } catch (error) {
      await db.rollback();
      const code = (error as { code?: string }).code;
      if (attempt === 2 || !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code || ''))
        throw error;
    } finally {
      db.release();
    }
    await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
  }
  throw new Error('Transaction retry limit reached');
}
