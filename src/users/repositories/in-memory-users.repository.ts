import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NewUser, User } from '../interfaces/user.interface.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly users = new Map<string, User>()

  // Stands in for the database, so it generates id and createdAt itself
  async create ({ email, firstName, lastName }: NewUser) {
    const user: User = {
      id: randomUUID(),
      email,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    }

    this.users.set(user.id, user)
    return user
  }

  async findById (id: string) {
    return this.users.get(id)
  }

  async findByEmail (email: string) {
    return Array.from(this.users.values()).find(user => user.email === email)
  }

  async findAll () {
    return Array.from(this.users.values())
  }
}
