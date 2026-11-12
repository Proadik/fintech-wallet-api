import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { UsersRepository } from './repositories/users.repository.js';
import { InMemoryUsersRepository } from './repositories/in-memory-users.repository.js';
import { UniqueViolationError } from '../common/errors/unique-violation.error.js';

const dto = {
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useClass: InMemoryUsersRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('returns the user with a generated id and createdAt', async () => {
      const user = await service.create(dto);

      expect(user).toEqual({
        ...dto,
        id: expect.any(String),
        createdAt: expect.any(String),
      });
      expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
    });

    it('stores the user so it can be read back', async () => {
      const user = await service.create(dto);

      expect(await service.getOne(user.id)).toEqual(user);
    });

    it('gives every user a unique id', async () => {
      const first = await service.create(dto);
      const second = await service.create({ ...dto, email: 'jane@example.com' });

      expect(first.id).not.toBe(second.id);
    });

    it('throws ConflictException when the email is already taken', async () => {
      await service.create(dto);

      await expect(service.create({ ...dto, firstName: 'Other' })).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
      expect(await service.getAll()).toHaveLength(1);
    });

    it('stores the email in lower case', async () => {
      const user = await service.create({ ...dto, email: 'John@Example.COM' });

      expect(user.email).toBe('john@example.com');
      expect((await service.getOne(user.id)).email).toBe('john@example.com');
    });

    it('trims whitespace around the email', async () => {
      const user = await service.create({ ...dto, email: '  John@x.com \n' });

      expect(user.email).toBe('john@x.com');
      await expect(service.create({ ...dto, email: ' john@x.com' })).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
      expect(await service.getAll()).toHaveLength(1);
    });

    it('treats emails that differ only by case as the same email', async () => {
      await service.create({ ...dto, email: 'John@x.com' });

      await expect(service.create({ ...dto, email: 'john@x.com' })).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
      await expect(service.create({ ...dto, email: 'JOHN@X.COM' })).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
      expect(await service.getAll()).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('returns an empty array when there are no users', async () => {
      expect(await service.getAll()).toEqual([]);
    });

    it('returns every created user', async () => {
      const first = await service.create(dto);
      const second = await service.create({ ...dto, email: 'jane@example.com' });

      expect(await service.getAll()).toEqual([first, second]);
    });
  });

  describe('getOne', () => {
    it('returns the user by id', async () => {
      const user = await service.create(dto);

      expect(await service.getOne(user.id)).toEqual(user);
    });

    it('throws NotFoundException for an unknown id', async () => {
      await expect(service.getOne('missing')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  // Two requests can both pass the "email is free" check; the storage then rejects the second
  it('throws ConflictException when the storage reports a duplicate email', async () => {
    const racing = new UsersService({
      findByEmail: async () => undefined,
      create: async () => { throw new UniqueViolationError() },
    } as unknown as UsersRepository);

    await expect(racing.create(dto)).rejects.toThrow(
      new ConflictException('Email already taken'),
    );
  });
});
