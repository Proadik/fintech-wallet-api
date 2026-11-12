import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersRepository } from './repositories/users.repository.js';
import { UniqueViolationError } from '../common/errors/unique-violation.error.js';
import { User } from './interfaces/user.interface.js';

const dto = {
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
};

const user: User = {
  ...dto,
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('UsersService', () => {
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    vi.resetAllMocks();
    repository.create.mockResolvedValue(user);
    service = new UsersService(repository as unknown as UsersRepository);
  });

  describe('create', () => {
    it('stores the user and returns what the repository created', async () => {
      await expect(service.create(dto)).resolves.toEqual(user);

      expect(repository.create).toHaveBeenCalledWith(dto);
    });

    it('stores the email in lower case', async () => {
      await service.create({ ...dto, email: 'John@Example.COM' });

      expect(repository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(repository.create).toHaveBeenCalledWith(dto);
    });

    it('trims whitespace around the email', async () => {
      await service.create({ ...dto, email: '  John@Example.com \n' });

      expect(repository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(repository.create).toHaveBeenCalledWith(dto);
    });

    it('throws ConflictException when the email is already taken', async () => {
      repository.findByEmail.mockResolvedValue(user);

      await expect(service.create({ ...dto, firstName: 'Other' })).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    // Two requests can both pass the "email is free" check; the storage then rejects the second
    it('throws ConflictException when the storage reports a duplicate email', async () => {
      repository.create.mockRejectedValue(new UniqueViolationError());

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
    });

    it('passes other storage errors through', async () => {
      repository.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(dto)).rejects.toThrow('connection lost');
    });
  });

  describe('getAll', () => {
    it('returns the users from the repository', async () => {
      repository.findAll.mockResolvedValue([user]);

      await expect(service.getAll()).resolves.toEqual([user]);
    });
  });

  describe('getOne', () => {
    it('returns the user by id', async () => {
      repository.findById.mockResolvedValue(user);

      await expect(service.getOne(user.id)).resolves.toEqual(user);
      expect(repository.findById).toHaveBeenCalledWith(user.id);
    });

    it('throws NotFoundException for an unknown id', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.getOne('missing')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });
});
