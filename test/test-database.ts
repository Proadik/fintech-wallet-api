import { existsSync } from 'node:fs';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Server and database a connection string points at, without credentials and options:
// the same database is the same database whoever connects to it
function targetOf (connection: string, name: string) {
  let url: URL;

  try {
    url = new URL(connection);
  } catch {
    throw new Error(`${name} is not a valid connection URL`);
  }

  const host = LOCAL_HOSTS.has(url.hostname.toLowerCase()) ? 'localhost' : url.hostname.toLowerCase();

  return `${host}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
}

// The tests create and delete rows, so they run only on a database set aside for them.
// There is deliberately no fallback to DATABASE_URL
export function requireTestDatabaseUrl (): string {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. The e2e and database tests need a PostgreSQL database of their own: ' +
      'create one, set TEST_DATABASE_URL in .env and run `npm run db:migrate:test`.',
    );
  }

  const mainUrl = process.env.MAIN_DATABASE_URL ?? process.env.DATABASE_URL;

  if (mainUrl && targetOf(testUrl, 'TEST_DATABASE_URL') === targetOf(mainUrl, 'DATABASE_URL')) {
    throw new Error(
      'TEST_DATABASE_URL points at the same database as DATABASE_URL. ' +
      'The tests must not run on the main database: use a separate one.',
    );
  }

  return testUrl;
}
