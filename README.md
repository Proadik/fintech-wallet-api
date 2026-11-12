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

A small wallet API built with [NestJS](https://nestjs.com): create users, open currency wallets for them and read both back. Data is stored in PostgreSQL through [Drizzle ORM](https://orm.drizzle.team) — see [Storage](#storage).

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
├── common/filters/             # AllExceptionsFilter: one error format for every failure
├── database/
│   ├── database.module.ts      # Drizzle connection, reads DATABASE_URL
│   └── schema/                 # users and wallets tables
├── users/
│   ├── users.controller.ts     # HTTP layer
│   ├── users.service.ts        # business rules
│   ├── dto/                    # request body validation
│   ├── interfaces/             # User
│   └── repositories/           # UsersRepository + Drizzle and in-memory implementations
└── wallets/
    ├── wallets.controller.ts
    ├── user-wallets.controller.ts   # GET /users/:id/wallets
    ├── wallets.service.ts
    ├── dto/
    ├── interfaces/             # Wallet
    └── repositories/           # WalletsRepository + Drizzle and in-memory implementations
```

Each request goes through three layers:

1. **Controller** — routing, status codes and parameter parsing. No business logic.
2. **Service** — the rules: unique email, one wallet per currency per user, "not found" errors.
3. **Repository** — storage. Services depend on the abstract classes `UsersRepository` and `WalletsRepository`, never on a concrete store.

The abstract class doubles as the dependency-injection token, and each module binds it to an implementation:

```ts
{ provide: UsersRepository, useClass: DrizzleUsersRepository }
```

Swapping the storage means writing a new class that extends the repository and changing that one line; services and controllers stay as they are.

`WalletsModule` imports `UsersModule` and uses `UsersService` to check that the wallet owner exists.

## Endpoints

| Method | Path                 | Description                  | Success | Errors             |
| ------ | -------------------- | ---------------------------- | ------- | ------------------ |
| `POST` | `/users`             | Create a user                | `201`   | `400`, `409`       |
| `GET`  | `/users`             | List all users               | `200`   | —                  |
| `GET`  | `/users/:id`         | Get one user                 | `200`   | `400`, `404`       |
| `GET`  | `/users/:id/wallets` | List a user's wallets        | `200`   | `400`, `404`       |
| `POST` | `/wallets`           | Open a wallet for a user     | `201`   | `400`, `404`, `409` |
| `GET`  | `/wallets/:id`       | Get one wallet               | `200`   | `400`, `404`       |

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
| `400`  | The body fails validation, or `:id` is not a UUID                                 |
| `404`  | `User not found`, `Wallet not found`, or an unknown route                         |
| `409`  | `Email already taken`, or `User already has a <currency> wallet`                  |
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

### Path parameters

Every `:id` must be a UUID; anything else gets `400` with `Validation failed (uuid is expected)`.

## Run tests

Tests run on [Vitest](https://vitest.dev).

```bash
# unit tests (src/**/*.spec.ts)
$ npm run test

# unit tests in watch mode
$ npm run test:watch

# e2e tests (test/**/*.e2e-spec.ts)
$ npm run test:e2e

# tests against a real PostgreSQL (test/**/*.db-spec.ts)
$ npm run test:db

# test coverage
$ npm run test:cov
```

- **Unit tests** sit next to the code and cover the services' rules against the in-memory repositories.
- **E2e tests** start the whole application and call it over HTTP with `supertest`. `test/create-app.ts` drops the database module and swaps in the in-memory repositories; each test gets a fresh app, so the storage starts empty every time.

- **Database tests** start the application on a real PostgreSQL with the Drizzle repositories. They cover what the other suites cannot: 50 simultaneous `POST /wallets` for one user and currency must create exactly one wallet and answer `409` to the other 49.

The unit and e2e suites need no database. `npm run test:db` connects to `TEST_DATABASE_URL`, or to `DATABASE_URL` from `.env` when that is not set, and expects the migrations to be applied. Each test creates its own user and deletes it, with its wallets, afterwards.

## Storage

The application stores data in PostgreSQL. `DatabaseModule` registers the connection with `@nestjs/drizzle` from `DATABASE_URL`, and `DrizzleUsersRepository` and `DrizzleWalletsRepository` implement the repository contracts on top of it.

| Table     | Columns                                                  | Constraints                                         |
| --------- | -------------------------------------------------------- | --------------------------------------------------- |
| `users`   | `id`, `email`, `first_name`, `last_name`, `created_at`   | `email` is unique                                   |
| `wallets` | `id`, `user_id`, `currency`, `balance_minor`, `created_at` | `user_id` references `users`; `(user_id, currency)` is unique; `balance_minor >= 0`; `currency` is one of `USD`, `EUR`, `KZT` |

`balance_minor` is a `bigint` holding the balance in minor units (cents, tiyn). The API still returns it as a decimal string: `12345` is sent as `"123.45"`.

The services check for a duplicate before inserting, but two simultaneous requests can both pass that check. The unique constraints then reject the second insert, and the service answers `409` exactly as it does for an ordinary duplicate.

Known limitations:

- **No pagination.** `GET /users` returns every user in one response.
- **No update or delete endpoints.**

### In-memory repositories

`InMemoryUsersRepository` and `InMemoryWalletsRepository` keep data in a `Map` inside the process. They are used by the tests only: nothing is persisted, each process has its own data, and uniqueness is enforced by the services alone.

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
