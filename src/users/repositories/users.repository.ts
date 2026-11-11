import { User } from '../interfaces/user.interface.js';

export abstract class UsersRepository {
  abstract save(user: User): User
  abstract findById(id: string): User | undefined
  abstract findByEmail(email: string): User | undefined
  abstract findAll(): User[]
}
