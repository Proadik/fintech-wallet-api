import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { WalletsService } from './wallets.service.js';

@Controller('users/:id/wallets')
export class UserWalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.walletsService.getUserWallets(id)
  }
}
