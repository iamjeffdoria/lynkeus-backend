import { pgTable, uuid, text, timestamp, integer, date, unique, boolean } from 'drizzle-orm/pg-core'

export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  fileName: text('file_name'),
  title: text('title'),
  extractedText: text('extracted_text').notNull(),
  tag: text('tag'),
  imageData: text('image_data'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const usageDaily = pgTable('usage_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  usageDate: date('usage_date').notNull(),
  count: integer('count').notNull().default(0),
}, (table) => ({
  userDateUnique: unique().on(table.userId, table.usageDate),
}))

export const userOnboarding = pgTable('user_onboarding', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  completed: boolean('completed').notNull().default(false),
  currentStep: integer('current_step').notNull().default(0),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
})