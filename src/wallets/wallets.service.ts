import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { WalletsRepository } from './repositories/wallets.repository.js';
import { UniqueViolationError } from '../common/errors/unique-violation.error.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class WalletsService {
  constructor(
    private readonly wallets: WalletsRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateWalletDto) {
    await this.usersService.getOne(dto.userId);

    const userWallets = await this.wallets.findByUserId(dto.userId)

    const conflict = new ConflictException(`User already has a ${dto.currency} wallet`)

    if (userWallets.some((w => w.currency === dto.currency))) {
      throw conflict
    }

    try {
      return await this.wallets.create({
        userId: dto.userId,
        currency: dto.currency,
      });
    } catch (error) {
      // A concurrent request created the same wallet after the check above
      if (error instanceof UniqueViolationError) {
        throw conflict
      }

      throw error
    }
  }

  async getOne(id: string) {
    const wallet = await this.wallets.findById(id);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getUserWallets (id: string) {
    await this.usersService.getOne(id)
    return this.wallets.findByUserId(id)
  };
}
