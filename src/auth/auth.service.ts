import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.createWithWallet({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      passwordHash: await argon2.hash(dto.password),
    });
    return this.toAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(
      dto.email.toLowerCase().trim(),
    );
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.toAuthResponse(user);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.incrementTokenVersion(userId);
    return { message: 'Sesión cerrada correctamente' };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            balance: user.wallet.balance,
            currency: user.wallet.currency,
          }
        : undefined,
    };
  }

  private async toAuthResponse(
    user: Prisma.UserGetPayload<{ include: { wallet: true } }>,
  ) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        wallet: user.wallet
          ? {
              id: user.wallet.id,
              balance: user.wallet.balance,
              currency: user.wallet.currency,
            }
          : undefined,
      },
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
    };
  }
}
