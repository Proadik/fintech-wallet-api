import {
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWalletDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;
  @IsNotEmpty()
  @IsIn(['USD', 'EUR', 'KZT'])
  currency: string;
}
