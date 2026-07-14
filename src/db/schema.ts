import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  fileName: text('file_name'),
  extractedText: text('extracted_text').notNull(),
  tag: text('tag'),
  imageData: text('image_data'),
  createdAt: timestamp('created_at').defaultNow(),
})