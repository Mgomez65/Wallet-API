import { ApiProperty } from '@nestjs/swagger';
import { IsDecimal, IsPositive, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: '2f8f7d35-9b44-4a4f-9f3e-8d4b0a2d8b1c' })
  @IsUUID()
  receiverId!: string;

  @ApiProperty({ example: '30000.00' })
  @IsDecimal({ decimal_digits: '0,2' })
  @IsPositive()
  amount!: string;
}
