import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { TransfersService } from './transfers.service.js';
import { IdempotencyKeyGuard } from '../common/guards/idempotency-key.guard.js';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @UseGuards(IdempotencyKeyGuard)
  create(
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.transfersService.create(dto, idempotencyKey);
  }
}
