import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/enums';

function isPrismaConflict(error: unknown): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async createWithWallet(data: {
    name: string;
    email: string;
    passwordHash: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          role: Role.USER,
          wallet: { create: { currency: 'ARS' } },
        },
        include: { wallet: true },
      });
    } catch (error: unknown) {
      if (isPrismaConflict(error)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async incrementTokenVersion(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}
