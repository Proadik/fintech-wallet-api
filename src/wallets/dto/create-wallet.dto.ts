import {
  IsEnum,
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
  @IsEnum(['USD', 'EUR', 'KZT'])
  currency: string;
}
