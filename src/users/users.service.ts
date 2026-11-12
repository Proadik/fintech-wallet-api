import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UniqueViolationError } from '../common/errors/unique-violation.error.js';
import { UsersRepository } from './repositories/users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase()

    const conflict = new ConflictException('Email already taken')

    if (await this.users.findByEmail(email)) {
      throw conflict
    }

    try {
      return await this.users.create({
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
    } catch (error) {
      // A concurrent request registered the same email after the check above
      if (error instanceof UniqueViolationError) {
        throw conflict
      }

      throw error
    }
  }

  getAll () {
    return this.users.findAll()
  }

  async getOne (id: string) {
    const user = await this.users.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
