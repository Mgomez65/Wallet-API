import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get('users') users() {
    return this.service.users();
  }
  @Get('wallets') wallets() {
    return this.service.wallets();
  }
  @Get('transfers') transfers() {
    return this.service.transfers();
  }
  @Get('transactions') transactions() {
    return this.service.transactions();
  }
  @Get('stats') stats() {
    return this.service.stats();
  }
}
