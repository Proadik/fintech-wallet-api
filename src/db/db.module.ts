import { Global, Module } from '@nestjs/common';
import { DB } from './db.js';

@Global()
@Module({
  providers: [DB],
  exports: [DB],
})
export class DbModule {}
