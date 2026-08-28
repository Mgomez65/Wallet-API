import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { DepositDto } from './dto/deposit.dto';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet no encontrada');
    return {
      walletId: wallet.id,
      balance: wallet.balance,
      currency: wallet.currency,
    };
  }

  async deposit(userId: string, dto: DepositDto) {
    const amount = new Prisma.Decimal(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet no encontrada');
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore.add(amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          amount,
          balanceBefore,
          balanceAfter,
          status: TransactionStatus.COMPLETED,
          reference: `DEP-${crypto.randomUUID()}`,
        },
      });
      await tx.notification.create({
        data: {
          userId,
          type: 'DEPOSIT',
          title: 'Depósito acreditado',
          message: `Se acreditaron ${amount.toFixed(2)} ${wallet.currency}`,
        },
      });
      return {
        walletId: wallet.id,
        balance: balanceAfter,
        currency: wallet.currency,
        transactionId: transaction.id,
      };
    });
  }
}
