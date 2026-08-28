import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { DepositDto } from './dto/deposit.dto';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar la wallet propia' })
  getMine(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.walletsService.getMine(request.user.id);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Realizar depósito simulado' })
  deposit(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: DepositDto,
  ) {
    return this.walletsService.deposit(request.user.id, dto);
  }
}
