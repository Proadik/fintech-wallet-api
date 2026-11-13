import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller.js';
import { UserWalletsController } from './user-wallets.controller.js';
import { WalletsService } from './wallets.service.js';
import { UsersModule } from '../users/users.module.js';
import { WalletsRepository } from './repositories/wallets.repository.js';
import { DrizzleWalletsRepository } from './repositories/drizzle-wallets.repository.js';

@Module({
  imports: [UsersModule],
  controllers: [WalletsController, UserWalletsController],
  providers: [
    WalletsService,
    { provide: WalletsRepository, useClass: DrizzleWalletsRepository },
  ],
  exports: [WalletsService],
})
export class WalletsModule {}
