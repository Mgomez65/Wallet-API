import { ApiProperty } from '@nestjs/swagger';
import { IsDecimal, IsPositive } from 'class-validator';

export class DepositDto {
  @ApiProperty({ example: '50000.00' })
  @IsDecimal({ decimal_digits: '0,2' })
  @IsPositive()
  amount!: string;
}
