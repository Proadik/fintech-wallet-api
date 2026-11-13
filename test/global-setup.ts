import { requireTestDatabaseUrl } from './test-database.js';

// Runs once before any test file: without a proper test database nothing starts at all
export default function setup () {
  requireTestDatabaseUrl();
}
