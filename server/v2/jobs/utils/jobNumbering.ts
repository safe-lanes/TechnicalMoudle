import { getDb } from '../../../db';
import { sql } from 'drizzle-orm';

export async function generateJobNumber(taskType?: string): Promise<string> {
  const db = await getDb();
  const prefix = 'JOB';

  const result = await db.execute(
    sql`SELECT job_no FROM jobs WHERE job_no LIKE ${prefix + '-%'} ORDER BY job_no DESC LIMIT 1`
  );

  let nextNum = 1;
  if (result.rows && result.rows.length > 0) {
    const lastNo = (result.rows[0] as any).job_no as string;
    const numPart = lastNo.replace(prefix + '-', '');
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  return `${prefix}-${String(nextNum).padStart(7, '0')}`;
}
