import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service.js';
import { UsersService } from '../users/users.service.js';
import { UsersRepository } from '../users/repositories/users.repository.js';
import { InMemoryUsersRepository } from '../users/repositories/in-memory-users.repository.js';
import { WalletsRepository } from './repositories/wallets.repository.js';
import { InMemoryWalletsRepository } from './repositories/in-memory-wallets.repository.js';

describe('WalletsService', () => {
  let service: WalletsService;
  let usersService: UsersService;
  let userId: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        UsersService,
        { provide: UsersRepository, useClass: InMemoryUsersRepository },
        { provide: WalletsRepository, useClass: InMemoryWalletsRepository },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    usersService = module.get<UsersService>(UsersService);

    userId = (await usersService.create({
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
    })).id;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('returns the wallet with a generated id, zero balance and createdAt', async () => {
      const wallet = await service.create({ userId, currency: 'USD' });

      expect(wallet).toEqual({
        id: expect.any(String),
        userId,
        currency: 'USD',
        balance: '0.00',
        createdAt: expect.any(String),
      });
      expect(new Date(wallet.createdAt).toISOString()).toBe(wallet.createdAt);
    });

    it('stores the wallet so it can be read back', async () => {
      const wallet = await service.create({ userId, currency: 'USD' });

      expect(await service.getOne(wallet.id)).toEqual(wallet);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      await expect(service.create({ userId: 'missing', currency: 'USD' })).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('throws ConflictException when the user already has a wallet in that currency', async () => {
      await service.create({ userId, currency: 'USD' });

      await expect(service.create({ userId, currency: 'USD' })).rejects.toThrow(
        new ConflictException('User already has a USD wallet'),
      );
      expect(await service.getUserWallets(userId)).toHaveLength(1);
    });

    it('allows one user to have wallets in different currencies', async () => {
      const usd = await service.create({ userId, currency: 'USD' });
      const eur = await service.create({ userId, currency: 'EUR' });

      expect(usd.id).not.toBe(eur.id);
      expect(await service.getUserWallets(userId)).toEqual([usd, eur]);
    });

    it('allows different users to have wallets in the same currency', async () => {
      const otherUserId = (await usersService.create({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      })).id;

      await service.create({ userId, currency: 'USD' });

      await expect(service.create({ userId: otherUserId, currency: 'USD' })).resolves.toBeDefined();
    });
  });

  describe('getOne', () => {
    it('returns the wallet by id', async () => {
      const wallet = await service.create({ userId, currency: 'KZT' });

      expect(await service.getOne(wallet.id)).toEqual(wallet);
    });

    it('throws NotFoundException for an unknown id', async () => {
      await expect(service.getOne('missing')).rejects.toThrow(
        new NotFoundException('Wallet not found'),
      );
    });
  });

  describe('getUserWallets', () => {
    it('returns an empty array when the user has no wallets', async () => {
      expect(await service.getUserWallets(userId)).toEqual([]);
    });

    it('returns only the wallets that belong to the user', async () => {
      const otherUserId = (await usersService.create({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      })).id;

      const mine = await service.create({ userId, currency: 'USD' });
      await service.create({ userId: otherUserId, currency: 'USD' });

      expect(await service.getUserWallets(userId)).toEqual([mine]);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      await expect(service.getUserWallets('missing')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });
});
