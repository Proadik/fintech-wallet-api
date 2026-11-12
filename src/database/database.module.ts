import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Database = NodePgDatabase

// What `db.transaction()` passes to its callback
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

// A repository runs its queries on the pool or, inside a TransactionRunner, on a transaction
export type DatabaseExecutor = Database | Transaction

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      useFactory: () => {
        const connection = process.env.DATABASE_URL

        if (!connection) {
          throw new Error('DATABASE_URL is not set')
        }

        return { drizzle, connection }
      },
    }),
  ],
})
export class DatabaseModule {}
