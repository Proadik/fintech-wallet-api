import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module.js';
import { rethrowUniqueViolation } from '../../database/unique-violation.js';
import { userSchema } from '../../database/schema/index.js';
import { NewUser, User } from '../interfaces/user.interface.js';
import { UsersRepository } from './users.repository.js';

type UserRow = typeof userSchema.$inferSelect

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  constructor (@InjectDrizzle() private readonly db: Database) {
    super()
  }

  async create ({ email, firstName, lastName }: NewUser) {
    const [row] = await rethrowUniqueViolation(
      this.db.insert(userSchema).values({ email, firstName, lastName }).returning(),
    )

    return this.toUser(row)
  }

  async findById (id: string) {
    const [row] = await this.db.select().from(userSchema).where(eq(userSchema.id, id))
    return row && this.toUser(row)
  }

  async findByEmail (email: string) {
    const [row] = await this.db.select().from(userSchema).where(eq(userSchema.email, email))
    return row && this.toUser(row)
  }

  async findAll () {
    const rows = await this.db.select().from(userSchema).orderBy(userSchema.createdAt)
    return rows.map(row => this.toUser(row))
  }

  private toUser (row: UserRow): User {
    return { ...row, createdAt: row.createdAt.toISOString() }
  }
}
