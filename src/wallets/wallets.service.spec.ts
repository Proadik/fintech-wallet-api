import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service.js';
import { UsersService } from '../users/users.service.js';
import { DB } from '../db/db.js';

describe('WalletsService', () => {
  let service: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletsService, UsersService, DB],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
