import { db } from '../db';
import { wallets, ledgerEntries, users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export interface WalletTxInput {
  idempotencyKey: string;
  userId: number;
  actorId?: number;
  type:
    | 'deposit_gateway'
    | 'withdrawal_gateway'
    | 'agent_deposit'
    | 'agent_withdrawal'
    | 'bet_stake'
    | 'bet_win'
    | 'bet_refund'
    | 'agent_commission'
    | 'bonus_credit';
  amount: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export class WalletService {
  static async executeTransaction(input: WalletTxInput) {
    if (input.amount === 0) {
      throw new Error('Transaction amount cannot be zero');
    }

    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.idempotencyKey, input.idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        return {
          status: 'duplicate_ignored',
          entry: existing[0],
          balance: existing[0].afterBalance,
        };
      }

      const lockedRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id = ${input.userId} FOR UPDATE`
      );

      const wallet = lockedRows.rows[0] as
        | { id: number; user_id: number; main_balance: string }
        | undefined;

      if (!wallet) {
        throw new Error(`Wallet not found for user ${input.userId}`);
      }

      const beforeBalance = parseFloat(wallet.main_balance);
      const afterBalance = Number((beforeBalance + input.amount).toFixed(2));

      if (afterBalance < 0) {
        throw new Error('Insufficient ETB balance');
      }

      await tx
        .update(wallets)
        .set({
          mainBalance: afterBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      const [entry] = await tx
        .insert(ledgerEntries)
        .values({
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
          actorId: input.actorId ?? input.userId,
          type: input.type,
          amount: input.amount.toFixed(2),
          beforeBalance: beforeBalance.toFixed(2),
          afterBalance: afterBalance.toFixed(2),
          referenceId: input.referenceId,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        })
        .returning();

      return {
        status: 'committed',
        entry,
        balance: afterBalance.toFixed(2),
      };
    });
  }

  static async agentTransferToPlayer(params: {
    idempotencyKey: string;
    agentId: number;
    playerId: number;
    amount: number;
  }) {
    if (params.amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    return await db.transaction(async (tx) => {
      const [agent] = await tx
        .select()
        .from(users)
        .where(eq(users.id, params.agentId));

      if (
        !agent ||
        !['super_admin', 'master_agent', 'shop_agent'].includes(agent.role)
      ) {
        throw new Error('Unauthorized agent account');
      }

      const [firstId, secondId] =
        params.agentId < params.playerId
          ? [params.agentId, params.playerId]
          : [params.playerId, params.agentId];

      await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id IN (${firstId}, ${secondId}) ORDER BY user_id ASC FOR UPDATE`
      );

      if (agent.role !== 'super_admin') {
        await this.executeTransaction({
          idempotencyKey: `${params.idempotencyKey}_debit`,
          userId: params.agentId,
          actorId: params.agentId,
          type: 'agent_deposit',
          amount: -params.amount,
          referenceId: `PLAYER_${params.playerId}`,
        });
      }

      return await this.executeTransaction({
        idempotencyKey: `${params.idempotencyKey}_credit`,
        userId: params.playerId,
        actorId: params.agentId,
        type: 'agent_deposit',
        amount: params.amount,
        referenceId: `AGENT_${params.agentId}`,
      });
    });
  }
}
