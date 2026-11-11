import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { randomUUID } from 'node:crypto';
import { UsersRepository } from './repositories/users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase()

    if (this.users.findByEmail(email)) {
      throw new ConflictException('Email already taken')
    }

    const id = randomUUID()

    return this.users.save({
      ...dto,
      email,
      id,
      createdAt: new Date().toISOString(),
    });
  }

  getAll () {
    return this.users.findAll()
  }

  getOne (id: string) {
    return this.checkUserExistence(id)
  }

  checkUserExistence (id: string) {
    const user = this.users.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
