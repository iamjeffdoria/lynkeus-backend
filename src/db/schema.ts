import { pgTable, uuid, text, timestamp, integer, date, unique } from 'drizzle-orm/pg-core'

export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  fileName: text('file_name'),
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