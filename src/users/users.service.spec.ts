import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { UsersRepository } from './repositories/users.repository.js';
import { InMemoryUsersRepository } from './repositories/in-memory-users.repository.js';

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
    it('returns the user with a generated id and createdAt', () => {
      const user = service.create(dto);

      expect(user).toEqual({
        ...dto,
        id: expect.any(String),
        createdAt: expect.any(String),
      });
      expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
    });

    it('stores the user so it can be read back', () => {
      const user = service.create(dto);

      expect(service.getOne(user.id)).toEqual(user);
    });

    it('gives every user a unique id', () => {
      const first = service.create(dto);
      const second = service.create({ ...dto, email: 'jane@example.com' });

      expect(first.id).not.toBe(second.id);
    });

    it('throws ConflictException when the email is already taken', () => {
      service.create(dto);

      expect(() => service.create({ ...dto, firstName: 'Other' })).toThrow(
        new ConflictException('Email already taken'),
      );
      expect(service.getAll()).toHaveLength(1);
    });

    it('stores the email in lower case', () => {
      const user = service.create({ ...dto, email: 'John@Example.COM' });

      expect(user.email).toBe('john@example.com');
      expect(service.getOne(user.id).email).toBe('john@example.com');
    });

    it('trims whitespace around the email', () => {
      const user = service.create({ ...dto, email: '  John@x.com \n' });

      expect(user.email).toBe('john@x.com');
      expect(() => service.create({ ...dto, email: ' john@x.com' })).toThrow(
        new ConflictException('Email already taken'),
      );
      expect(service.getAll()).toHaveLength(1);
    });

    it('treats emails that differ only by case as the same email', () => {
      service.create({ ...dto, email: 'John@x.com' });

      expect(() => service.create({ ...dto, email: 'john@x.com' })).toThrow(
        new ConflictException('Email already taken'),
      );
      expect(() => service.create({ ...dto, email: 'JOHN@X.COM' })).toThrow(
        new ConflictException('Email already taken'),
      );
      expect(service.getAll()).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('returns an empty array when there are no users', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('returns every created user', () => {
      const first = service.create(dto);
      const second = service.create({ ...dto, email: 'jane@example.com' });

      expect(service.getAll()).toEqual([first, second]);
    });
  });

  describe('getOne', () => {
    it('returns the user by id', () => {
      const user = service.create(dto);

      expect(service.getOne(user.id)).toEqual(user);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.getOne('missing')).toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('checkUserExistence', () => {
    it('returns the user when it exists', () => {
      const user = service.create(dto);

      expect(service.checkUserExistence(user.id)).toEqual(user);
    });

    it('throws NotFoundException when the user does not exist', () => {
      expect(() => service.checkUserExistence('missing')).toThrow(
        new NotFoundException('User not found'),
      );
    });
  });
});
