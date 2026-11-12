import { InjectDrizzle } from '@nestjs/drizzle';
import type { DatabaseExecutor } from '../../database/database.module.js';
import { idempotencyRecordsSchema } from '../../database/schema/index.js';
import { NewIdempotencyRecord, } from '../interfaces/idempotency.interface.js';
import { eq } from 'drizzle-orm';

export class IdempotencyRecordsRepository {
  constructor(@InjectDrizzle() private readonly db: DatabaseExecutor) {}

  async create(data: NewIdempotencyRecord) {
    const [row] = await this.db
      .insert(idempotencyRecordsSchema)
      .values(data)
      .onConflictDoNothing({ target: idempotencyRecordsSchema.key })
      .returning();

    return row
  }

  async update (id: string, data: Partial<NewIdempotencyRecord>) {
    const [row] = await this.db
      .update(idempotencyRecordsSchema)
      .set({ ...data })
      .where(eq(idempotencyRecordsSchema.id, id))
      .returning()

    return row
  }

  async find (key: string) {
    const [row] = await this.db.select().from(idempotencyRecordsSchema).where(eq(idempotencyRecordsSchema.key, key))
    return row
  }
}
