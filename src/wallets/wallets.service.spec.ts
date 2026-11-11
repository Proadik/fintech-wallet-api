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

    userId = usersService.create({
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
    }).id;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('returns the wallet with a generated id, zero balance and createdAt', () => {
      const wallet = service.create({ userId, currency: 'USD' });

      expect(wallet).toEqual({
        id: expect.any(String),
        userId,
        currency: 'USD',
        balance: '0.00',
        createdAt: expect.any(String),
      });
      expect(new Date(wallet.createdAt).toISOString()).toBe(wallet.createdAt);
    });

    it('stores the wallet so it can be read back', () => {
      const wallet = service.create({ userId, currency: 'USD' });

      expect(service.getOne(wallet.id)).toEqual(wallet);
    });

    it('throws NotFoundException when the user does not exist', () => {
      expect(() =>
        service.create({ userId: 'missing', currency: 'USD' }),
      ).toThrow(new NotFoundException('User not found'));
    });

    it('throws ConflictException when the user already has a wallet in that currency', () => {
      service.create({ userId, currency: 'USD' });

      expect(() => service.create({ userId, currency: 'USD' })).toThrow(
        new ConflictException('User already has a USD wallet'),
      );
      expect(service.getUserWallets(userId)).toHaveLength(1);
    });

    it('allows one user to have wallets in different currencies', () => {
      const usd = service.create({ userId, currency: 'USD' });
      const eur = service.create({ userId, currency: 'EUR' });

      expect(usd.id).not.toBe(eur.id);
      expect(service.getUserWallets(userId)).toEqual([usd, eur]);
    });

    it('allows different users to have wallets in the same currency', () => {
      const otherUserId = usersService.create({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      }).id;

      service.create({ userId, currency: 'USD' });

      expect(() =>
        service.create({ userId: otherUserId, currency: 'USD' }),
      ).not.toThrow();
    });
  });

  describe('getOne', () => {
    it('returns the wallet by id', () => {
      const wallet = service.create({ userId, currency: 'KZT' });

      expect(service.getOne(wallet.id)).toEqual(wallet);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.getOne('missing')).toThrow(
        new NotFoundException('Wallet not found'),
      );
    });
  });

  describe('getUserWallets', () => {
    it('returns an empty array when the user has no wallets', () => {
      expect(service.getUserWallets(userId)).toEqual([]);
    });

    it('returns only the wallets that belong to the user', () => {
      const otherUserId = usersService.create({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      }).id;

      const mine = service.create({ userId, currency: 'USD' });
      service.create({ userId: otherUserId, currency: 'USD' });

      expect(service.getUserWallets(userId)).toEqual([mine]);
    });

    it('throws NotFoundException when the user does not exist', () => {
      expect(() => service.getUserWallets('missing')).toThrow(
        new NotFoundException('User not found'),
      );
    });
  });
});
