<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

A small wallet API built with [NestJS](https://nestjs.com): create users, open currency wallets for them and move money between wallets with [transfers](#transfers) that are safe to retry and safe to run concurrently. Data is stored in PostgreSQL through [Drizzle ORM](https://orm.drizzle.team) — see [Storage](#storage).

## Project setup

```bash
$ npm install
$ cp .env.example .env
```

Set `DATABASE_URL` in `.env` to a PostgreSQL database, then create the tables:

```bash
# write SQL migrations into ./drizzle from the schema in src/database/schema
$ npm run db:generate

# apply them to the database in DATABASE_URL
$ npm run db:migrate
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run build
$ npm run start:prod
```

The `start`, `start:dev` and `start:debug` scripts load `.env` through `nest start --env-file .env`. `start:prod` runs plain `node`, so `PORT` and `DATABASE_URL` must already be in the environment. The server listens on `PORT`, or on `3001` when it is not set. The examples below use `http://localhost:3001`.

## Architecture

```
src/
├── main.ts                     # bootstrap, reads PORT
├── app.module.ts               # global ValidationPipe and exception filter
├── common/
│   ├── filters/                # AllExceptionsFilter: one error format for every failure
│   ├── guards/                 # IdempotencyKeyGuard: requires the Idempotency-Key header
│   ├── transactions/           # TransactionRunner: the transaction boundary contract
│   └── money.ts                # decimal string <-> minor units
├── database/
│   ├── database.module.ts      # Drizzle connection, reads DATABASE_URL
│   ├── drizzle-transaction-runner.ts   # TransactionRunner on a PostgreSQL transaction
│   └── schema/                 # users, wallets, transfers, ledger_entries, idempotency_records
├── users/
│   ├── users.controller.ts     # HTTP layer
│   ├── users.service.ts        # business rules
│   ├── dto/                    # request body validation
│   ├── interfaces/             # User
│   └── repositories/           # UsersRepository and its Drizzle implementation
├── wallets/
│   ├── wallets.controller.ts
│   ├── user-wallets.controller.ts   # GET /users/:id/wallets
│   ├── wallets.service.ts
│   ├── dto/
│   ├── interfaces/             # Wallet
│   └── repositories/           # WalletsRepository and its Drizzle implementation
└── transfers/
    ├── transfers.controller.ts # POST /transfers
    ├── transfers.service.ts    # the transfer operation, inside one transaction
    ├── dto/
    ├── interfaces/             # Transfer, LedgerEntryRecord, IdempotencyRecord
    └── repositories/           # transfers, ledger entries and idempotency records
```

Each request goes through three layers:

1. **Controller** — routing, status codes and parameter parsing. No business logic.
2. **Service** — the rules: unique email, one wallet per currency per user, enough money for a transfer, "not found" errors.
3. **Repository** — storage. Services depend on the abstract classes `UsersRepository` and `WalletsRepository`, never on a concrete store.

The abstract class doubles as the dependency-injection token, and each module binds it to an implementation:

```ts
{ provide: UsersRepository, useClass: DrizzleUsersRepository }
```

Swapping the storage means writing a new class that extends the repository and changing that one line; services and controllers stay as they are.

`WalletsModule` imports `UsersModule` and uses `UsersService` to check that the wallet owner exists. `TransfersService` does not inject repositories at all: it gets them from `TransactionRunner`, bound to one database transaction — see [Transactions](#transactions).

## Endpoints

| Method | Path                 | Description                  | Success | Errors             |
| ------ | -------------------- | ---------------------------- | ------- | ------------------ |
| `POST` | `/users`             | Create a user                | `201`   | `400`, `409`       |
| `GET`  | `/users`             | List all users               | `200`   | —                  |
| `GET`  | `/users/:id`         | Get one user                 | `200`   | `400`, `404`       |
| `GET`  | `/users/:id/wallets` | List a user's wallets        | `200`   | `400`, `404`       |
| `POST` | `/wallets`           | Open a wallet for a user     | `201`   | `400`, `404`, `409` |
| `GET`  | `/wallets/:id`       | Get one wallet               | `200`   | `400`, `404`       |
| `POST` | `/transfers`         | Move money between wallets   | `201`   | `400`, `404`, `409`, `422` |

### Error format

Every error, including validation failures and unknown routes, has the same shape:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Email already taken",
  "timestamp": "2026-11-11T13:10:02.011Z",
  "path": "/users"
}
```

`message` is always a string; several validation messages are joined with `, `.

| Status | When                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| `400`  | The body fails validation, `:id` is not a UUID, the `Idempotency-Key` header is missing or not a UUID, or `Currency mismatch` |
| `404`  | `User not found`, `Wallet not found`, or an unknown route                         |
| `409`  | `Email already taken`, `User already has a <currency> wallet`, or `Idempotency key already used with different request parameters` |
| `422`  | `Insufficient funds`                                                              |
| `500`  | Anything unexpected; the response says only `Internal server error`               |

## Request examples

### Create a user

```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"email": "John@Example.com", "firstName": "John", "lastName": "Doe"}'
```

```json
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "id": "74af4c3c-7d5d-435d-9757-309eed538494",
  "createdAt": "2026-11-11T13:10:01.833Z"
}
```

### List users and get one

```bash
curl http://localhost:3001/users
curl http://localhost:3001/users/74af4c3c-7d5d-435d-9757-309eed538494
```

`GET /users` returns an array of users (`[]` when there are none); `GET /users/:id` returns a single user object.

### Open a wallet

```bash
curl -X POST http://localhost:3001/wallets \
  -H "Content-Type: application/json" \
  -d '{"userId": "74af4c3c-7d5d-435d-9757-309eed538494", "currency": "USD"}'
```

```json
{
  "userId": "74af4c3c-7d5d-435d-9757-309eed538494",
  "currency": "USD",
  "id": "a5f302c5-3bae-428e-a730-84969e52813a",
  "balance": "0.00",
  "createdAt": "2026-11-11T13:10:02.058Z"
}
```

### Get a wallet and list a user's wallets

```bash
curl http://localhost:3001/wallets/a5f302c5-3bae-428e-a730-84969e52813a
curl http://localhost:3001/users/74af4c3c-7d5d-435d-9757-309eed538494/wallets
```

### Transfer money

```bash
curl -X POST http://localhost:3001/transfers \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 9701f537-90cb-4e89-9f53-d7614d96bfa6" \
  -d '{"fromWalletId": "a5f302c5-3bae-428e-a730-84969e52813a", "toWalletId": "b92b280c-3396-49cb-b0cc-9438729b629b", "amount": "150.00", "currency": "KZT"}'
```

The first request answers `201` with an empty body. Sending the same request again with the same key answers `201` with the id of the transfer that was already made, and moves nothing:

```json
{
  "transferId": "3f0e7c1a-2b0d-4a53-8d39-0a4f5a3f3c11"
}
```

The same key with a different body is refused:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Idempotency key already used with different request parameters",
  "timestamp": "2026-11-12T18:42:16.318Z",
  "path": "/transfers"
}
```

### A failed request

```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "firstName": "J", "lastName": "Doe", "role": "admin"}'
```

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "property role should not exist, firstName must be longer than or equal to 2 characters",
  "timestamp": "2026-11-11T13:10:01.996Z",
  "path": "/users"
}
```

## Validation rules

Bodies are checked by a global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`, so a property that is not listed below is rejected with `400`.

### `POST /users`

| Field       | Rules                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| `email`     | Required, a valid email. Stored in lower case.                           |
| `firstName` | Required string, 2–50 characters after trimming surrounding whitespace.  |
| `lastName`  | Required string, 2–50 characters after trimming surrounding whitespace.  |

Emails are unique regardless of case: `John@x.com` and `john@x.com` are the same address, and the second registration gets `409`.

### `POST /wallets`

| Field      | Rules                                              |
| ---------- | -------------------------------------------------- |
| `userId`   | Required, a UUID of an existing user (else `404`). |
| `currency` | Required, one of `USD`, `EUR`, `KZT`.              |

A user can hold one wallet per currency; a second wallet in the same currency gets `409`. A new wallet always starts with `balance: "0.00"`. The balance is a decimal string, not a number, so it never loses precision.

### `POST /transfers`

| Field / header    | Rules                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `Idempotency-Key` | Required header, a UUID. Checked before the body.                            |
| `fromWalletId`    | Required, a UUID of an existing wallet (else `404`).                         |
| `toWalletId`      | Required, a UUID of an existing wallet (else `404`).                         |
| `amount`          | Required decimal string in the currency's main units: `"150"` or `"150.00"`, at most two decimal places. |
| `currency`        | Required, one of `USD`, `EUR`, `KZT`. Must be the currency of both wallets (else `400 Currency mismatch`). |

The sender must hold at least `amount`, otherwise the transfer gets `422 Insufficient funds` and nothing changes.

### Path parameters

Every `:id` must be a UUID; anything else gets `400` with `Validation failed (uuid is expected)`.

## Transfers

`POST /transfers` moves `amount` from one wallet to another. One transfer writes, in a single database transaction:

1. an idempotency record for the request's key;
2. the new balances of both wallets;
3. a row in `transfers`;
4. two ledger entries — `-amount` for the sender's wallet and `+amount` for the receiver's — which always sum to zero.

Money is integer arithmetic. The API takes and returns decimal strings (`"150.00"`); `src/common/money.ts` converts them to `bigint` minor units (`15000`) for every comparison, update and stored value, so nothing is ever rounded.

### Idempotency

A client that did not get a response cannot tell whether the transfer happened, so it must be able to repeat the request safely. Every `POST /transfers` carries an `Idempotency-Key` header, a UUID the client generates once per transfer and sends again with every retry. `IdempotencyKeyGuard` rejects a request without a valid key with `400` before the body is even validated.

The service hashes the fields that define the transfer — both wallet ids, the amount in minor units and the currency (SHA-256) — and inserts the key with that hash as the first step of the transaction:

| The key                                  | Result                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| is new                                   | The transfer runs; the record is linked to it.                     |
| exists with the same request hash        | `201` with the earlier `transferId`; no money moves.               |
| exists with a different request hash     | `409 Idempotency key already used with different request parameters` |

The insert is `INSERT ... ON CONFLICT DO NOTHING`: a taken key yields no row instead of an error, which would abort the transaction. Two simultaneous requests with one key are safe too — the second waits on the unique index until the first commits, then sees its record.

Because the key is stored in the same transaction as the money movement, a transfer that fails (`404`, `400`, `422`) rolls its key back as well, and the client can retry with the same key after fixing the cause.

### Transactions

`TransfersService` owns the business operation, the repositories own the queries, and everything one transfer changes must share one PostgreSQL transaction. The boundary is the abstract `TransactionRunner`:

```ts
return this.transactions.run(async ({ wallets, transfers, ledgerEntries, idempotency }) => {
  // every query made through these repositories is part of one transaction
})
```

`DrizzleTransactionRunner` opens `db.transaction()` and builds the repositories on the transaction object instead of the connection pool. When the callback resolves the transaction commits; when it throws, everything is rolled back. The service never sees a Drizzle type, and it cannot forget to pass the transaction along. Repositories injected through a constructor query the pool and are **not** part of a transaction — inside `run`, use only the ones it hands out.

### Concurrency

- **Row locks before the balance check.** The transfer first locks both wallet rows with `SELECT ... FOR UPDATE`, then reads the balance. Concurrent transfers from one wallet therefore run one after another, each seeing the previous result, so the wallet cannot be overdrawn.
- **Locks are taken in wallet-id order**, whatever the direction of the transfer. Opposite transfers A → B and B → A then wait for each other instead of deadlocking.
- **The debit repeats the condition**: `UPDATE ... SET balance_minor = balance_minor - $1 WHERE balance_minor >= $1`. If no row is updated the transfer fails with `422`; and `CHECK (balance_minor >= 0)` is the last line of defence.

## Run tests

Tests run on [Vitest](https://vitest.dev).

```bash
# unit tests (src/**/*.spec.ts)
$ npm run test

# unit tests in watch mode
$ npm run test:watch

# e2e tests against a real PostgreSQL (test/**/*.e2e-spec.ts)
$ npm run test:e2e

# concurrency and transaction tests against a real PostgreSQL (test/**/*.db-spec.ts)
$ npm run test:db

# test coverage
$ npm run test:cov
```

- **Unit tests** sit next to the code and cover the services' rules with the repositories mocked (`vi.fn()`).
- **E2e tests** start the whole application and call it over HTTP with `supertest`. They run on a real PostgreSQL with the Drizzle repositories.

- **Database tests** also run on a real PostgreSQL and cover what needs direct access to it: `TransactionRunner` commits and rolls back as a whole, and 50 simultaneous `POST /wallets` for one user and currency must create exactly one wallet and answer `409` to the other 49. For transfers: 100 concurrent transfers from one wallet are each applied once, a wallet with money for 50 of them is never overdrawn, opposite transfers between two wallets do not deadlock, and a reused `Idempotency-Key` does not move money twice.

The unit suite needs no database. `npm run test:e2e` and `npm run test:db` connect to `TEST_DATABASE_URL`, or to `DATABASE_URL` from `.env` when that is not set, and expect the migrations to be applied. Each spec file creates its own users and deletes them, with their wallets, afterwards; rows it did not create are left alone.

## Storage

The application stores data in PostgreSQL. `DatabaseModule` registers the connection with `@nestjs/drizzle` from `DATABASE_URL`, and the Drizzle repositories implement the repository contracts on top of it.

| Table     | Columns                                                  | Constraints                                         |
| --------- | -------------------------------------------------------- | --------------------------------------------------- |
| `users`   | `id`, `email`, `first_name`, `last_name`, `created_at`   | `email` is unique                                   |
| `wallets` | `id`, `user_id`, `currency`, `balance_minor`, `created_at` | `user_id` references `users`; `(user_id, currency)` is unique; `balance_minor >= 0`; `currency` is one of `USD`, `EUR`, `KZT` |
| `transfers` | `id`, `from_wallet_id`, `to_wallet_id`, `amount_minor`, `currency`, `status`, `created_at` | both wallet ids reference `wallets`; `amount_minor > 0`; `from_wallet_id <> to_wallet_id` |
| `ledger_entries` | `id`, `transfer_id`, `wallet_id`, `amount`, `created_at` | `transfer_id` references `transfers`; `wallet_id` references `wallets` |
| `idempotency_records` | `id`, `key`, `request_hash`, `transfer_id`, `created_at` | `key` is unique; `transfer_id` references `transfers` |

`balance_minor`, `amount_minor` and the ledger `amount` are `bigint` values in minor units (cents, tiyn). The API still works with decimal strings: `12345` is sent as `"123.45"`. A ledger `amount` is signed: negative for the wallet that paid, positive for the one that received.

No foreign key cascades: a user with wallets, or a wallet with transfers, cannot be deleted.

The services check for a duplicate before inserting, but two simultaneous requests can both pass that check. The unique constraints then reject the second insert, and the service answers `409` exactly as it does for an ordinary duplicate.

Known limitations:

- **No pagination.** `GET /users` returns every user in one response.
- **No update or delete endpoints**, and no endpoints to read transfers or a wallet's ledger.
- **No way to fund a wallet through the API.** Wallets start at `0.00`; money only moves between wallets.
- **`amount` is not validated in the DTO.** A malformed, negative or zero amount, and a transfer from a wallet to itself, are stopped by the money parser or by the database constraints, but the client gets `500` instead of `400`.
- **The first response to a transfer has an empty body**, while a repeat returns `{ "transferId": ... }`.
- **Idempotency keys are global and never expire.** There is no authentication, so keys are not scoped to a user.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
