import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './repositories/users.repository.js';
import { DrizzleUsersRepository } from './repositories/drizzle-users.repository.js';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: UsersRepository, useClass: DrizzleUsersRepository },
  ],
  exports: [UsersService],
})

export class UsersModule {}
