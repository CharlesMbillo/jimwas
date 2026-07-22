import { pgTable, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'

// Better Auth Tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
})

// KCB OAuth Session Table for tracking KCB-specific sessions
export const kcbSession = pgTable('kcbSession', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  kcbUserId: text('kcbUserId').notNull(),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  tokenType: text('tokenType').default('Bearer'),
  expiresAt: timestamp('expiresAt').notNull(),
  scope: text('scope'),
  requestedAt: timestamp('requestedAt').notNull(),
  expiresIn: integer('expiresIn'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

// KCB OAuth State Table for CSRF protection during authorization flow
export const kcbOAuthState = pgTable('kcbOAuthState', {
  id: text('id').primaryKey(),
  state: text('state').notNull().unique(),
  codeChallenge: text('codeChallenge'),
  redirectUri: text('redirectUri').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull(),
})
