import { IsIn, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { LowercaseUuid } from '../../common/transforms/lowercase-uuid.js';

export class CreateTransferDto {
  @IsNotEmpty()
  @IsUUID()
  @LowercaseUuid()
  fromWalletId: string;

  @IsNotEmpty()
  @IsUUID()
  @LowercaseUuid()
  toWalletId: string;

  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,2})?$/, { message: 'amount must be a positive decimal string with at most two decimal places, e.g. "150.00"', })
  @Matches(/[1-9]/, { message: 'amount must be greater than zero' })
  amount: string;

  @IsNotEmpty()
  @IsIn(['USD', 'EUR', 'KZT'])
  currency: string;
}
