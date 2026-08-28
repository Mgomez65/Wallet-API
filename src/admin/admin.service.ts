import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        wallet: { select: { id: true, balance: true, currency: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  wallets() {
    return this.prisma.wallet.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  transfers() {
    return this.prisma.transfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  transactions() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async stats() {
    const [users, wallets, transfers, completed, failed, volume] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.wallet.count(),
        this.prisma.transfer.count(),
        this.prisma.transfer.count({ where: { status: 'COMPLETED' } }),
        this.prisma.transfer.count({ where: { status: 'FAILED' } }),
        this.prisma.transfer.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amount: true },
        }),
      ]);
    return {
      users,
      wallets,
      transfers,
      completedTransfers: completed,
      failedTransfers: failed,
      totalTransferred: volume._sum.amount ?? 0,
    };
  }
}
