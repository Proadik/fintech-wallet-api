import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller.js';
import { WalletsService } from './wallets.service.js';
import { UsersService } from '../users/users.service.js';
import { DB } from '../db/db.js';

describe('WalletsController', () => {
  let controller: WalletsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [WalletsService, UsersService, DB],
    }).compile();

    controller = module.get<WalletsController>(WalletsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
