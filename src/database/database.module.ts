import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Database = NodePgDatabase

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
