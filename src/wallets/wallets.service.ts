import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { DB } from '../db/db.js';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class WalletsService {
  constructor(
    private readonly db: DB,
    private readonly usersService: UsersService,
  ) {}

  create(dto: CreateWalletDto) {
    this.usersService.checkUserExistence(dto.userId);

    const userWallets = this.db.getAll('wallets').filter(wallet => wallet.userId === dto.userId)

    if (userWallets.some((w => w.currency === dto.currency))) {
      throw new ConflictException(`User already has a ${dto.currency} wallet`)
    }

    const id = randomUUID();

    return this.db.save('wallets', id, {
      ...dto,
      id,
      balance: '0.00',
      createdAt: new Date().toISOString(),
    });
  }

  getOne(id: string) {
    const wallet = this.db.getItem('wallets', id);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  getUserWallets (id: string) {
    this.usersService.checkUserExistence(id)

    return this.db.getAll('wallets').filter(wallet => wallet.userId === id)
  };
}
