import { NewUser, User } from '../interfaces/user.interface.js';

export abstract class UsersRepository {
  abstract create(data: NewUser): Promise<User>
  abstract findById(id: string): Promise<User | undefined>
  abstract findByEmail(email: string): Promise<User | undefined>
  abstract findAll(): Promise<User[]>
}
