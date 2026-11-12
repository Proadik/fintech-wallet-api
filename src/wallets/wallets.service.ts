import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { WalletsRepository } from './repositories/wallets.repository.js';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class WalletsService {
  constructor(
    private readonly wallets: WalletsRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateWalletDto) {
    await this.usersService.checkUserExistence(dto.userId);

    const userWallets = await this.wallets.findByUserId(dto.userId)

    if (userWallets.some((w => w.currency === dto.currency))) {
      throw new ConflictException(`User already has a ${dto.currency} wallet`)
    }

    const id = randomUUID();

    return this.wallets.save({
      ...dto,
      id,
      balance: '0.00',
      createdAt: new Date().toISOString(),
    });
  }

  async getOne(id: string) {
    const wallet = await this.wallets.findById(id);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getUserWallets (id: string) {
    await this.usersService.checkUserExistence(id)

    return this.wallets.findByUserId(id)
  };
}
