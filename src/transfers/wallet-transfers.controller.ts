import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';

@Controller('wallets/:walletId/transfers')
export class WalletTransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  getAll(@Param('walletId', ParseUUIDPipe) walletId: string) {
    return this.transfersService.getWalletTransfers(walletId);
  }
}
