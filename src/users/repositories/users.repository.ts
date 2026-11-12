import { User } from '../interfaces/user.interface.js';

export abstract class UsersRepository {
  abstract save(user: User): Promise<User>
  abstract findById(id: string): Promise<User | undefined>
  abstract findByEmail(email: string): Promise<User | undefined>
  abstract findAll(): Promise<User[]>
}
