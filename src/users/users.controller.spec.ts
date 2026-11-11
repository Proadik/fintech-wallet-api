import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './repositories/users.repository.js';
import { InMemoryUsersRepository } from './repositories/in-memory-users.repository.js';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: UsersRepository, useClass: InMemoryUsersRepository },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
