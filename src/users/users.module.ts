import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './repositories/users.repository.js';
import { InMemoryUsersRepository } from './repositories/in-memory-users.repository.js';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: UsersRepository, useClass: InMemoryUsersRepository },
  ],
  exports: [UsersService],
})

export class UsersModule {}
