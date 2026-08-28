import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  TransactionStatus,
  TransactionType,
  TransferStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

function isPrismaConflict(error: unknown): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(
    senderUserId: string,
    dto: CreateTransferDto,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey?.trim())
      throw new ConflictException('Falta Idempotency-Key');
    const cacheKey = `idempotency:transfer:${senderUserId}:${idempotencyKey.trim()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed: unknown = JSON.parse(cached);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          ...(parsed as Record<string, unknown>),
          idempotentReplay: true,
        };
      }
    }
    const amount = new Prisma.Decimal(dto.amount);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const sender = await tx.wallet.findUnique({
            where: { userId: senderUserId },
          });
          const receiver = await tx.wallet.findUnique({
            where: { userId: dto.receiverId },
          });
          if (!sender || !receiver)
            throw new NotFoundException(
              'Wallet emisora o receptora no encontrada',
            );
          if (sender.id === receiver.id)
            throw new UnprocessableEntityException(
              'No puedes transferirte a ti mismo',
            );

          const [firstId, secondId] = [sender.id, receiver.id].sort();
          const locked = await tx.$queryRaw<
            Array<{ id: string; balance: Prisma.Decimal; currency: string }>
          >`
          SELECT id, balance, currency FROM Wallet WHERE id IN (${firstId}, ${secondId}) ORDER BY id FOR UPDATE
        `;
          const lockedById = new Map(
            locked.map((wallet) => [wallet.id, wallet]),
          );
          const lockedSender = lockedById.get(sender.id)!;
          const lockedReceiver = lockedById.get(receiver.id)!;
          if (lockedSender.currency !== lockedReceiver.currency) {
            throw new UnprocessableEntityException(
              'Las wallets deben usar la misma moneda',
            );
          }
          if (lockedSender.balance.lt(amount))
            throw new UnprocessableEntityException('Saldo insuficiente');

          const senderAfter = lockedSender.balance.sub(amount);
          const receiverAfter = lockedReceiver.balance.add(amount);
          const transfer = await tx.transfer.create({
            data: {
              senderWalletId: sender.id,
              receiverWalletId: receiver.id,
              amount,
              status: TransferStatus.COMPLETED,
              idempotencyKey: idempotencyKey.trim(),
              completedAt: new Date(),
            },
          });
          await tx.wallet.update({
            where: { id: sender.id },
            data: { balance: senderAfter },
          });
          await tx.wallet.update({
            where: { id: receiver.id },
            data: { balance: receiverAfter },
          });
          await tx.transaction.createMany({
            data: [
              {
                walletId: sender.id,
                transferId: transfer.id,
                type: TransactionType.TRANSFER_SENT,
                amount,
                balanceBefore: lockedSender.balance,
                balanceAfter: senderAfter,
                status: TransactionStatus.COMPLETED,
                reference: `TR-${transfer.id}`,
              },
              {
                walletId: receiver.id,
                transferId: transfer.id,
                type: TransactionType.TRANSFER_RECEIVED,
                amount,
                balanceBefore: lockedReceiver.balance,
                balanceAfter: receiverAfter,
                status: TransactionStatus.COMPLETED,
                reference: `TR-${transfer.id}`,
              },
            ],
          });
          await tx.notification.createMany({
            data: [
              {
                userId: senderUserId,
                type: 'TRANSFER_SENT',
                title: 'Transferencia enviada',
                message: `Enviaste ${amount.toFixed(2)} ${lockedSender.currency}`,
              },
              {
                userId: dto.receiverId,
                type: 'TRANSFER_RECEIVED',
                title: 'Transferencia recibida',
                message: `Recibiste ${amount.toFixed(2)} ${lockedReceiver.currency}`,
              },
            ],
          });
          const response = {
            id: transfer.id,
            status: transfer.status,
            amount: transfer.amount,
            senderBalance: senderAfter,
          };
          await this.redis.setEx(cacheKey, 86_400, JSON.stringify(response));
          return response;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error: unknown) {
      if (isPrismaConflict(error)) {
        const existing = await this.prisma.transfer.findUnique({
          where: {
            senderWalletId_idempotencyKey: {
              senderWalletId: (
                await this.prisma.wallet.findUniqueOrThrow({
                  where: { userId: senderUserId },
                })
              ).id,
              idempotencyKey: idempotencyKey.trim(),
            },
          },
        });
        if (existing)
          return {
            id: existing.id,
            status: existing.status,
            amount: existing.amount,
            idempotentReplay: true,
          };
      }
      throw error;
    }
  }

  findMine(userId: string) {
    return this.prisma.transfer.findMany({
      where: {
        OR: [{ senderWallet: { userId } }, { receiverWallet: { userId } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: {
        id,
        OR: [{ senderWallet: { userId } }, { receiverWallet: { userId } }],
      },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    return transfer;
  }
}
