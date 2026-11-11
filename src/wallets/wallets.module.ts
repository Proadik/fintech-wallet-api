import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller.js';
import { UserWalletsController } from './user-wallets.controller.js';
import { WalletsService } from './wallets.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [WalletsController, UserWalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
