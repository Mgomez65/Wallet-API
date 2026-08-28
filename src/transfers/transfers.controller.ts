import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Transferir fondos a otra wallet' })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.transfersService.create(request.user.id, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'Listar transferencias propias' })
  findMine(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.transfersService.findMine(request.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una transferencia propia' })
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.transfersService.findOne(request.user.id, id);
  }
}
