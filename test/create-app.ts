import { Test } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseModule } from '../src/database/database.module.js';
import { UsersRepository } from '../src/users/repositories/users.repository.js';
import { InMemoryUsersRepository } from '../src/users/repositories/in-memory-users.repository.js';
import { WalletsRepository } from '../src/wallets/repositories/wallets.repository.js';
import { InMemoryWalletsRepository } from '../src/wallets/repositories/in-memory-wallets.repository.js';

@Module({})
class NoDatabaseModule {}


// E2e tests run without Postgres: the database module is dropped and the repositories
// are swapped for the in-memory ones. A fresh app per test, so they start empty every time
export async function createApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideModule(DatabaseModule).useModule(NoDatabaseModule)
    .overrideProvider(UsersRepository).useClass(InMemoryUsersRepository)
    .overrideProvider(WalletsRepository).useClass(InMemoryWalletsRepository)
    .compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();

  return app;
}
