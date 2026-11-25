import {
  pgTable,
  serial,
  text,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'master_agent',
  'shop_agent',
  'player',
]);

export const txTypeEnum = pgEnum('tx_type', [
  'deposit_gateway',
  'withdrawal_gateway',
  'agent_deposit',
  'agent_withdrawal',
  'bet_stake',
  'bet_win',
  'bet_refund',
  'agent_commission',
  'bonus_credit',
]);

export const betStatusEnum = pgEnum('bet_status', [
  'pending',
  'won',
  'lost',
  'void',
  'cashed_out',
]);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    firebaseUid: varchar('firebase_uid', { length: 128 }).unique(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    role: userRoleEnum('role').default('player').notNull(),
    parentAgentId: integer('parent_agent_id'),
    commissionRate: numeric('commission_rate', { precision: 5, scale: 2 })
      .default('0.00')
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    kycVerified: boolean('kyc_verified').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    phoneIdx: uniqueIndex('users_phone_idx').on(table.phone),
    parentIdx: index('users_parent_agent_idx').on(table.parentAgentId),
  })
);

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),
  currency: varchar('currency', { length: 3 }).default('ETB').notNull(),
  mainBalance: numeric('main_balance', { precision: 14, scale: 2 })
    .default('0.00')
    .notNull(),
  bonusBalance: numeric('bonus_balance', { precision: 14, scale: 2 })
    .default('0.00')
    .notNull(),
  commissionBalance: numeric('commission_balance', { precision: 14, scale: 2 })
    .default('0.00')
    .notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: serial('id').primaryKey(),
    idempotencyKey: varchar('idempotency_key', { length: 128 })
      .notNull()
      .unique(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    actorId: integer('actor_id').references(() => users.id),
    type: txTypeEnum('type').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    beforeBalance: numeric('before_balance', { precision: 14, scale: 2 }).notNull(),
    afterBalance: numeric('after_balance', { precision: 14, scale: 2 }).notNull(),
    referenceId: varchar('reference_id', { length: 128 }),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('ledger_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    refIdx: index('ledger_reference_idx').on(table.referenceId),
  })
);

export const bets = pgTable(
  'bets',
  {
    id: serial('id').primaryKey(),
    ticketCode: varchar('ticket_code', { length: 12 }).notNull().unique(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    agentId: integer('agent_id').references(() => users.id),
    vertical: varchar('vertical', { length: 20 }).notNull(),
    stake: numeric('stake', { precision: 14, scale: 2 }).notNull(),
    totalOdds: numeric('total_odds', { precision: 10, scale: 3 }).notNull(),
    potentialWin: numeric('potential_win', { precision: 14, scale: 2 }).notNull(),
    payout: numeric('payout', { precision: 14, scale: 2 })
      .default('0.00')
      .notNull(),
    status: betStatusEnum('status').default('pending').notNull(),
    selectionsJson: text('selections_json').notNull(),
    settledAt: timestamp('settled_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index('bets_user_status_idx').on(table.userId, table.status),
    ticketIdx: uniqueIndex('bets_ticket_code_idx').on(table.ticketCode),
  })
);

export const bookingCodes = pgTable('booking_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 8 }).notNull().unique(),
  selectionsJson: text('selections_json').notNull(),
  totalOdds: numeric('total_odds', { precision: 10, scale: 3 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
