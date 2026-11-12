import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { Database } from '../src/database/database.module.js';
import { createDbApp } from './create-db-app.js';
import { createTestData } from './test-data.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const data = createTestData();

const validUser = {
  email: data.email('adil'),
  firstName: 'Adil',
  lastName: 'Kim',
};

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  beforeAll(async () => {
    ({ app, db } = await createDbApp());
  });

  // Every test starts without the users of the previous one
  afterEach(async () => {
    await data.cleanup(db);
  });

  afterAll(async () => {
    await app.close();
  });

  const createUser = (body: object) =>
    request(app.getHttpServer()).post('/users').send(body);

  it('creates a user with valid data → 201', async () => {
    const res = await createUser(validUser).expect(201);

    expect(res.body).toMatchObject(validUser);
    expect(res.body.id).toMatch(UUID_REGEX);
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });

  it('gives two users different UUIDs', async () => {
    const first = await createUser(validUser).expect(201);
    const second = await createUser({ ...validUser, email: data.email('other') }).expect(201);

    expect(first.body.id).toMatch(UUID_REGEX);
    expect(second.body.id).toMatch(UUID_REGEX);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it('rejects an invalid email → 400', async () => {
    const res = await createUser({ ...validUser, email: 'not-an-email' }).expect(400);

    expect(res.body.message).toContain('email must be an email');
  });

  it.each([
    ['empty firstName', { firstName: '' }],
    ['whitespace firstName', { firstName: '   ' }],
    ['empty lastName', { lastName: '' }],
    ['whitespace lastName', { lastName: '   ' }],
  ])('rejects %s → 400', async (_, override) => {
    await createUser({ ...validUser, ...override }).expect(400);
  });

  it('rejects the same email in a different case → 409', async () => {
    await createUser(validUser).expect(201);

    const res = await createUser({ ...validUser, email: validUser.email.toUpperCase() }).expect(409);

    expect(res.body.message).toBe('Email already taken');
  });

  it.each(['email', 'firstName', 'lastName'])('rejects a non-string %s → 400', async (field) => {
    const res = await createUser({ ...validUser, [field]: 123 }).expect(400);

    expect(res.body.message).toContain(field);
  });

  it('rejects unknown fields → 400', async () => {
    const res = await createUser({ ...validUser, id: MISSING_ID, role: 'admin' }).expect(400);

    expect(res.body.message).toContain('property id should not exist');
    expect(res.body.message).toContain('property role should not exist');
  });

  it('gets an existing user → 200', async () => {
    const created = await createUser(validUser).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/users/${created.body.id}`)
      .expect(200);

    expect(res.body).toEqual(created.body);
  });

  it('returns 404 for a missing user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${MISSING_ID}`)
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
      path: `/users/${MISSING_ID}`,
    });
  });
});
