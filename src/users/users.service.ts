import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { randomUUID } from 'node:crypto';
import { DB } from '../db/db.js';

@Injectable()
export class UsersService {
  constructor(private readonly db: DB) {}

  create(dto: CreateUserDto) {
    const isTaken = this.db.getAll('users').some(user => user.email === dto.email)

    if (isTaken) {
      throw new ConflictException('Email already taken')
    }

    const id = randomUUID()

    return this.db.save('users', id, {
      ...dto,
      id,
      createdAt: new Date().toISOString(),
    });
  }

  getAll () {
    return this.db.getAll('users')
  }

  getOne (id: string) {
    return this.checkUserExistence(id)
  }

  checkUserExistence (id: string) {
    const user = this.db.getItem('users', id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
