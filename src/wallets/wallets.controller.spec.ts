import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller.js';
import { WalletsService } from './wallets.service.js';
import { UsersService } from '../users/users.service.js';
import { UsersRepository } from '../users/repositories/users.repository.js';
import { InMemoryUsersRepository } from '../users/repositories/in-memory-users.repository.js';
import { WalletsRepository } from './repositories/wallets.repository.js';
import { InMemoryWalletsRepository } from './repositories/in-memory-wallets.repository.js';

describe('WalletsController', () => {
  let controller: WalletsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        WalletsService,
        UsersService,
        { provide: UsersRepository, useClass: InMemoryUsersRepository },
        { provide: WalletsRepository, useClass: InMemoryWalletsRepository },
      ],
    }).compile();

    controller = module.get<WalletsController>(WalletsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
