import { ConflictException, NotFoundException } from '@nestjs/common';
import { WalletsService } from './wallets.service.js';
import { UsersService } from '../users/users.service.js';
import { WalletsRepository } from './repositories/wallets.repository.js';
import { UniqueViolationError } from '../common/errors/unique-violation.error.js';
import { Wallet } from './interfaces/wallet.interface.js';

const userId = '11111111-1111-4111-8111-111111111111';

const usdWallet: Wallet = {
  id: '22222222-2222-4222-8222-222222222222',
  userId,
  currency: 'USD',
  balance: '0.00',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('WalletsService', () => {
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
  };

  const usersService = { getOne: vi.fn() };

  let service: WalletsService;

  beforeEach(() => {
    vi.resetAllMocks();
    repository.findByUserId.mockResolvedValue([]);
    repository.create.mockResolvedValue(usdWallet);

    service = new WalletsService(
      repository as unknown as WalletsRepository,
      usersService as unknown as UsersService,
    );
  });

  describe('create', () => {
    it('creates the wallet and returns what the repository created', async () => {
      await expect(service.create({ userId, currency: 'USD' })).resolves.toEqual(usdWallet);

      expect(repository.create).toHaveBeenCalledWith({ userId, currency: 'USD' });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersService.getOne.mockRejectedValue(new NotFoundException('User not found'));

      await expect(service.create({ userId: 'missing', currency: 'USD' })).rejects.toThrow(
        new NotFoundException('User not found'),
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user already has a wallet in that currency', async () => {
      repository.findByUserId.mockResolvedValue([usdWallet]);

      await expect(service.create({ userId, currency: 'USD' })).rejects.toThrow(
        new ConflictException('User already has a USD wallet'),
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('allows one user to have wallets in different currencies', async () => {
      repository.findByUserId.mockResolvedValue([usdWallet]);

      await service.create({ userId, currency: 'EUR' });

      expect(repository.create).toHaveBeenCalledWith({ userId, currency: 'EUR' });
    });

    // Two requests can both pass the "no such wallet yet" check; the storage then rejects the second
    it('throws ConflictException when the storage reports a duplicate wallet', async () => {
      repository.create.mockRejectedValue(new UniqueViolationError());

      await expect(service.create({ userId, currency: 'USD' })).rejects.toThrow(
        new ConflictException('User already has a USD wallet'),
      );
    });

    it('passes other storage errors through', async () => {
      repository.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.create({ userId, currency: 'USD' })).rejects.toThrow('connection lost');
    });
  });

  describe('getOne', () => {
    it('returns the wallet by id', async () => {
      repository.findById.mockResolvedValue(usdWallet);

      await expect(service.getOne(usdWallet.id)).resolves.toEqual(usdWallet);
      expect(repository.findById).toHaveBeenCalledWith(usdWallet.id);
    });

    it('throws NotFoundException for an unknown id', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.getOne('missing')).rejects.toThrow(
        new NotFoundException('Wallet not found'),
      );
    });
  });

  describe('getUserWallets', () => {
    it('returns the wallets of the user', async () => {
      repository.findByUserId.mockResolvedValue([usdWallet]);

      await expect(service.getUserWallets(userId)).resolves.toEqual([usdWallet]);
      expect(repository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersService.getOne.mockRejectedValue(new NotFoundException('User not found'));

      await expect(service.getUserWallets('missing')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
      expect(repository.findByUserId).not.toHaveBeenCalled();
    });
  });
});
