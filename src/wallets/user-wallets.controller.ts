import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { WalletsService } from './wallets.service.js';

@Controller('users/:id/wallets')
export class UserWalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.walletsService.getUserWallets(id)
  }
}
