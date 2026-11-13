import {
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';
import { LowercaseUuid } from '../../common/transforms/lowercase-uuid.js';

export class CreateWalletDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  @LowercaseUuid()
  userId: string;
  @IsNotEmpty()
  @IsIn(['USD', 'EUR', 'KZT'])
  currency: string;
}
