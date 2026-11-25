import { Router, Request, Response } from 'express';
import { WalletService } from '../services/walletService';
import { db } from '../db';
import { wallets, ledgerEntries } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// 1. Get a player's ETB wallet balance and recent ledger history
router.get('/balance/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const recentEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.userId, userId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(20);

    return res.json({ wallet, recentEntries });
  } catch (err) {
    console.error('GET /balance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Agent Cash-In Transfer (Agent -> Player)
router.post('/agent-transfer', async (req: Request, res: Response) => {
  try {
    const { idempotencyKey, agentId, playerId, amount } = req.body;

    if (!idempotencyKey || !agentId || !playerId || typeof amount !== 'number') {
      return res.status(400).json({
        error: 'Required: idempotencyKey, agentId, playerId, amount (number)',
      });
    }

    const result = await WalletService.agentTransferToPlayer({
      idempotencyKey: String(idempotencyKey),
      agentId: Number(agentId),
      playerId: Number(playerId),
      amount,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    return res.status(400).json({ error: message });
  }
});

// 3. Payment Gateway Deposit Webhook (Chapa / ArifPay / telebirr)
router.post('/deposit-webhook', async (req: Request, res: Response) => {
  try {
    const { txRef, userId, amount, provider } = req.body;

    if (!txRef || !userId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const result = await WalletService.executeTransaction({
      idempotencyKey: `gw_dep_${String(txRef)}`,
      userId: Number(userId),
      type: 'deposit_gateway',
      amount,
      referenceId: String(txRef),
      metadata: { provider: provider || 'chapa_arifpay' },
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Deposit failed';
    return res.status(400).json({ error: message });
  }
});

export default router;
