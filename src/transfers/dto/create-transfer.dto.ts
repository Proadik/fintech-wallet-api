import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @IsNotEmpty()
  @IsUUID()
  fromWalletId: string;

  @IsNotEmpty()
  @IsUUID()
  toWalletId: string;

  @IsNotEmpty()
  amount: string;

  @IsNotEmpty()
  @IsIn(['USD', 'EUR', 'KZT'])
  currency: string;
}
