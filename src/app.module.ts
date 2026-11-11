import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

@Module({
  imports: [UsersModule, WalletsModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    },
  ],
})
export class AppModule {}
