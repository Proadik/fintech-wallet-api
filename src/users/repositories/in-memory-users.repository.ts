import { Injectable } from '@nestjs/common';
import { User } from '../interfaces/user.interface.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly users = new Map<string, User>()

  save (user: User) {
    this.users.set(user.id, user)
    return user
  }

  findById (id: string) {
    return this.users.get(id)
  }

  findByEmail (email: string) {
    return this.findAll().find(user => user.email === email)
  }

  findAll () {
    return Array.from(this.users.values())
  }
}
