import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { TransfersService } from './transfers.service.js';
import { IdempotencyKeyGuard } from '../common/guards/idempotency-key.guard.js';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfersService.find(id);
  }

  @Post()
  @UseGuards(IdempotencyKeyGuard)
  create(
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    // The guard has checked that the key is a UUID; like the ids in the body it is used in lower case
    return this.transfersService.create(dto, idempotencyKey.toLowerCase());
  }
}
