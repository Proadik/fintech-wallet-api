import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';
import { TransfersRepository } from './repositories/transfers.repository.js';
import { TransactionalRepositories, TransactionRunner } from '../common/transactions/transaction-runner.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { Transfer } from './interfaces/transfer.interface.js';
import { Wallet } from '../wallets/interfaces/wallet.interface.js';

const FROM = '11111111-1111-4111-8111-11111111111a';
const TO = '22222222-2222-4222-8222-22222222222b';
const KEY = '33333333-3333-4333-8333-333333333333';

const dto = { fromWalletId: FROM, toWalletId: TO, amount: '150.00', currency: 'KZT' };

const wallet = (id: string, balance: string, currency = 'KZT'): Wallet => ({
  id,
  userId: '44444444-4444-4444-8444-444444444444',
  currency,
  balance,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const transfer: Transfer = {
  id: '55555555-5555-4555-8555-555555555555',
  ...dto,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const record = { id: '66666666-6666-4666-8666-666666666666', key: KEY };

describe('TransfersService', () => {
  // The repositories a transaction hands out
  const tx = {
    wallets: { lockByIds: vi.fn(), decreaseBalance: vi.fn(), increaseBalance: vi.fn() },
    transfers: { create: vi.fn(), findById: vi.fn() },
    ledgerEntries: { create: vi.fn() },
    idempotency: { create: vi.fn(), find: vi.fn(), update: vi.fn() },
  };

  const runner = { run: vi.fn() };
  // The repository injected into the service, outside any transaction
  const transfers = { findById: vi.fn(), findByWalletId: vi.fn() };
  const walletsService = { getOne: vi.fn() };

  let service: TransfersService;

  // The request hash the service stored with the key on the last new transfer
  const storedHash = () => tx.idempotency.create.mock.lastCall?.[0].requestHash as string;

  const expectNoMoneyMoved = () => {
    expect(tx.wallets.decreaseBalance).not.toHaveBeenCalled();
    expect(tx.wallets.increaseBalance).not.toHaveBeenCalled();
    expect(tx.transfers.create).not.toHaveBeenCalled();
    expect(tx.ledgerEntries.create).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // A successful transfer of 150.00 out of 1000.00 unless a test says otherwise
    runner.run.mockImplementation((work: (repos: TransactionalRepositories) => unknown) =>
      work(tx as unknown as TransactionalRepositories),
    );
    tx.idempotency.create.mockResolvedValue(record);
    tx.wallets.lockByIds.mockResolvedValue([wallet(FROM, '1000.00'), wallet(TO, '0.00')]);
    tx.wallets.decreaseBalance.mockResolvedValue(wallet(FROM, '850.00'));
    tx.wallets.increaseBalance.mockResolvedValue(wallet(TO, '150.00'));
    tx.transfers.create.mockResolvedValue(transfer);

    service = new TransfersService(
      runner as unknown as TransactionRunner,
      transfers as unknown as TransfersRepository,
      walletsService as unknown as WalletsService,
    );
  });

  describe('create', () => {
    it('moves the money and returns the transfer', async () => {
      await expect(service.create(dto, KEY)).resolves.toEqual(transfer);

      expect(tx.wallets.lockByIds).toHaveBeenCalledWith([FROM, TO]);
      expect(tx.wallets.decreaseBalance).toHaveBeenCalledWith(FROM, '150.00');
      expect(tx.wallets.increaseBalance).toHaveBeenCalledWith(TO, '150.00');
      expect(tx.transfers.create).toHaveBeenCalledWith(dto);
    });

    it('does everything inside one transaction', async () => {
      await service.create(dto, KEY);

      expect(runner.run).toHaveBeenCalledTimes(1);
    });

    it('writes a debit for the sender and a credit for the receiver', async () => {
      await service.create(dto, KEY);

      expect(tx.ledgerEntries.create).toHaveBeenCalledTimes(2);
      expect(tx.ledgerEntries.create).toHaveBeenCalledWith({
        transferId: transfer.id,
        walletId: FROM,
        direction: 'debit',
        amount: '150.00',
      });
      expect(tx.ledgerEntries.create).toHaveBeenCalledWith({
        transferId: transfer.id,
        walletId: TO,
        direction: 'credit',
        amount: '150.00',
      });
    });

    it('stores the key first and links it to the transfer at the end', async () => {
      await service.create(dto, KEY);

      expect(tx.idempotency.create).toHaveBeenCalledWith({
        key: KEY,
        transferId: null,
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      expect(tx.idempotency.update).toHaveBeenCalledWith(record.id, { transferId: transfer.id });

      const order = (mock: { mock: { invocationCallOrder: number[] } }) => mock.mock.invocationCallOrder[0];

      // Key, then locks, then the debit, then the credit
      expect(order(tx.idempotency.create)).toBeLessThan(order(tx.wallets.lockByIds));
      expect(order(tx.wallets.lockByIds)).toBeLessThan(order(tx.wallets.decreaseBalance));
      expect(order(tx.wallets.decreaseBalance)).toBeLessThan(order(tx.wallets.increaseBalance));
      expect(order(tx.wallets.increaseBalance)).toBeLessThan(order(tx.idempotency.update));
    });

    it('allows spending the whole balance', async () => {
      tx.wallets.lockByIds.mockResolvedValue([wallet(FROM, '150.00'), wallet(TO, '0.00')]);

      await expect(service.create(dto, KEY)).resolves.toEqual(transfer);
    });

    describe('same wallet', () => {
      it.each([
        ['the same id', FROM],
        ['the same id in another case', FROM.toUpperCase()],
      ])('rejects a transfer to %s without opening a transaction', (_, toWalletId) => {
        expect(() => service.create({ ...dto, toWalletId }, KEY)).toThrow(
          new BadRequestException('Cannot transfer to the same wallet'),
        );
        expect(runner.run).not.toHaveBeenCalled();
      });
    });

    describe('when the key was used before', () => {
      // Makes the first request, then sets the storage up as it is afterwards: the key is taken
      const repeatOf = async (first: typeof dto) => {
        await service.create(first, KEY);

        const requestHash = storedHash();

        vi.clearAllMocks();
        tx.idempotency.create.mockResolvedValue(undefined);
        tx.idempotency.find.mockResolvedValue({ ...record, requestHash, transferId: transfer.id });
        tx.transfers.findById.mockResolvedValue(transfer);

        return requestHash;
      };

      it('returns the earlier transfer and moves nothing', async () => {
        await repeatOf(dto);

        await expect(service.create(dto, KEY)).resolves.toEqual(transfer);

        expect(tx.transfers.findById).toHaveBeenCalledWith(transfer.id);
        expect(tx.wallets.lockByIds).not.toHaveBeenCalled();
        expectNoMoneyMoved();
      });

      it('treats the same amount written differently as the same request', async () => {
        await repeatOf({ ...dto, amount: '150.5' });

        await expect(service.create({ ...dto, amount: '150.50' }, KEY)).resolves.toEqual(transfer);
      });

      it.each([
        ['amount', { amount: '151.00' }],
        ['sender', { fromWalletId: '77777777-7777-4777-8777-777777777777' }],
        ['receiver', { toWalletId: '77777777-7777-4777-8777-777777777777' }],
        ['currency', { currency: 'USD' }],
      ])('throws ConflictException when the %s differs', async (_, change) => {
        await repeatOf(dto);

        await expect(service.create({ ...dto, ...change }, KEY)).rejects.toThrow(
          new ConflictException('Idempotency key already used with different request parameters'),
        );
        expectNoMoneyMoved();
      });

      it('throws NotFoundException when the earlier request left no transfer', async () => {
        const requestHash = await repeatOf(dto);

        tx.idempotency.find.mockResolvedValue({ ...record, requestHash, transferId: null });

        await expect(service.create(dto, KEY)).rejects.toThrow(NotFoundException);
      });
    });

    describe('wallets', () => {
      it.each([
        ['sender', [wallet(TO, '0.00')]],
        ['receiver', [wallet(FROM, '1000.00')]],
      ])('throws NotFoundException when the %s does not exist', async (_, locked) => {
        tx.wallets.lockByIds.mockResolvedValue(locked);

        await expect(service.create(dto, KEY)).rejects.toThrow(
          new NotFoundException('Wallet not found. Check the wallet ids.'),
        );
        expectNoMoneyMoved();
      });

      it.each([
        ['the wallets hold different currencies', [wallet(FROM, '1000.00', 'KZT'), wallet(TO, '0.00', 'USD')], 'KZT'],
        ['the request names another currency', [wallet(FROM, '1000.00'), wallet(TO, '0.00')], 'USD'],
      ])('throws BadRequestException when %s', async (_, locked, currency) => {
        tx.wallets.lockByIds.mockResolvedValue(locked);

        await expect(service.create({ ...dto, currency }, KEY)).rejects.toThrow(
          new BadRequestException('Currency mismatch'),
        );
        expectNoMoneyMoved();
      });
    });

    describe('insufficient funds', () => {
      it('throws ConflictException when the balance is smaller than the amount', async () => {
        tx.wallets.lockByIds.mockResolvedValue([wallet(FROM, '149.99'), wallet(TO, '0.00')]);

        await expect(service.create(dto, KEY)).rejects.toThrow(new ConflictException('Insufficient funds'));
        expectNoMoneyMoved();
      });

      // As strings '9.00' > '10.00' and '100.00' < '20.00'; the amounts must be compared as numbers
      it('compares amounts as numbers, not as strings', async () => {
        tx.wallets.lockByIds.mockResolvedValue([wallet(FROM, '9.00'), wallet(TO, '0.00')]);

        await expect(service.create({ ...dto, amount: '10.00' }, KEY)).rejects.toThrow(
          new ConflictException('Insufficient funds'),
        );

        tx.wallets.lockByIds.mockResolvedValue([wallet(FROM, '100.00'), wallet(TO, '0.00')]);

        await expect(service.create({ ...dto, amount: '20.00' }, KEY)).resolves.toEqual(transfer);
      });

      it('credits nothing when the debit did not go through', async () => {
        tx.wallets.decreaseBalance.mockResolvedValue(undefined);

        await expect(service.create(dto, KEY)).rejects.toThrow(new ConflictException('Insufficient funds'));

        expect(tx.wallets.increaseBalance).not.toHaveBeenCalled();
        expect(tx.transfers.create).not.toHaveBeenCalled();
        expect(tx.ledgerEntries.create).not.toHaveBeenCalled();
      });
    });

    it('passes storage errors through, so the transaction is rolled back', async () => {
      tx.transfers.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(dto, KEY)).rejects.toThrow('connection lost');
      expect(tx.idempotency.update).not.toHaveBeenCalled();
    });
  });

  describe('find', () => {
    it('returns the transfer by id', async () => {
      transfers.findById.mockResolvedValue(transfer);

      await expect(service.find(transfer.id)).resolves.toEqual(transfer);
      expect(transfers.findById).toHaveBeenCalledWith(transfer.id);
    });

    it('throws NotFoundException for an unknown id', async () => {
      transfers.findById.mockResolvedValue(undefined);

      await expect(service.find('missing')).rejects.toThrow(new NotFoundException('Transfer not found'));
    });
  });

  describe('getWalletTransfers', () => {
    it('returns the transfers of an existing wallet', async () => {
      transfers.findByWalletId.mockResolvedValue([transfer]);

      await expect(service.getWalletTransfers(FROM)).resolves.toEqual([transfer]);

      expect(walletsService.getOne).toHaveBeenCalledWith(FROM);
      expect(transfers.findByWalletId).toHaveBeenCalledWith(FROM);
    });

    it('throws NotFoundException when the wallet does not exist', async () => {
      walletsService.getOne.mockRejectedValue(new NotFoundException('Wallet not found'));

      await expect(service.getWalletTransfers(FROM)).rejects.toThrow(new NotFoundException('Wallet not found'));
      expect(transfers.findByWalletId).not.toHaveBeenCalled();
    });
  });
});
