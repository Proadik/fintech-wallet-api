import { Injectable } from '@nestjs/common';
import { User } from '../interfaces/user.interface.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly users = new Map<string, User>()

  async save (user: User) {
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
