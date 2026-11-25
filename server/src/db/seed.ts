import 'dotenv/config';
import { db } from './index';
import { users, wallets, ledgerEntries, bookingCodes } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding initial betting platform data...');

  const starterUsers = [
    {
      phone: '+251900000001',
      username: 'superadmin_et',
      role: 'super_admin' as const,
      commissionRate: '0.00',
      kycVerified: true,
    },
    {
      phone: '+251911000002',
      username: 'master_agent_1',
      role: 'master_agent' as const,
      commissionRate: '5.00',
      kycVerified: true,
    },
    {
      phone: '+251911000003',
      username: 'shop_agent_1',
      role: 'shop_agent' as const,
      commissionRate: '8.00',
      kycVerified: true,
    },
    {
      phone: '+251911000004',
      username: 'player_demo',
      role: 'player' as const,
      commissionRate: '0.00',
      kycVerified: false,
    },
  ];

  for (const u of starterUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.phone, u.phone))
      .limit(1);

    let userId: number;

    if (existing.length === 0) {
      const [inserted] = await db.insert(users).values(u).returning();
      userId = inserted.id;
    } else {
      userId = existing[0].id;
    }

    const existingWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (existingWallet.length === 0) {
      const startingBalance = u.role === 'super_admin' ? '100000.00' : '0.00';

      await db.insert(wallets).values({
        userId,
        currency: 'ETB',
        mainBalance: startingBalance,
        bonusBalance: '0.00',
        commissionBalance: '0.00',
      });

      if (u.role === 'super_admin') {
        await db.insert(ledgerEntries).values({
          idempotencyKey: 'seed_superadmin_float_001',
          userId,
          actorId: userId,
          type: 'bonus_credit',
          amount: '100000.00',
          beforeBalance: '0.00',
          afterBalance: '100000.00',
          referenceId: 'SEED_FLOAT',
          metadata: JSON.stringify({ note: 'Initial house bankroll float' }),
        });
      }
    }
  }

  const sampleCode = 'MEL888';
  const existingCode = await db
    .select()
    .from(bookingCodes)
    .where(eq(bookingCodes.code, sampleCode))
    .limit(1);

  if (existingCode.length === 0) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(bookingCodes).values({
      code: sampleCode,
      totalOdds: '4.500',
      expiresAt,
      selectionsJson: JSON.stringify([
        { match: 'Arsenal vs Chelsea', market: '1X2', pick: 'Home', odds: 2.1 },
        { match: 'Real Madrid vs Barcelona', market: 'Over/Under', pick: 'Over 2.5', odds: 2.143 },
      ]),
    });
  }

  console.log('Seed completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
