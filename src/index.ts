import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { db } from './db/index.js'
import { screenshots } from './db/schema.js'
import { desc, ilike, eq, and } from 'drizzle-orm'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Save a new screenshot's extracted text
app.post('/api/screenshots', async (req, res) => {
  try {
    const { userId, extractedText, tag, fileName, imageData } = req.body

    if (!userId || !extractedText) {
      return res.status(400).json({ error: 'userId and extractedText are required' })
    }

    const [saved] = await db
      .insert(screenshots)
      .values({ userId, extractedText, tag, fileName, imageData })
      .returning()

    res.status(201).json(saved)
  } catch (err) {
    console.error('[Lynkeus] failed to save screenshot:', err)
    res.status(500).json({ error: 'Failed to save screenshot' })
  }
})

// Fetch a user's screenshots, optionally filtered by search query
app.get('/api/screenshots', async (req, res) => {
  try {
    const { userId, search } = req.query

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' })
    }

    const results = search && typeof search === 'string'
      ? await db
          .select()
          .from(screenshots)
          .where(eq(screenshots.userId, userId))
          .orderBy(desc(screenshots.createdAt))
      : await db
          .select()
          .from(screenshots)
          .where(eq(screenshots.userId, userId))
          .orderBy(desc(screenshots.createdAt))

    // Simple in-memory filter for search (fine at MVP scale)
    const filtered = search && typeof search === 'string'
      ? results.filter((r) => r.extractedText.toLowerCase().includes(search.toLowerCase()))
      : results

    res.json(filtered)
  } catch (err) {
    console.error('[Lynkeus] failed to fetch screenshots:', err)
    res.status(500).json({ error: 'Failed to fetch screenshots' })
  }
})

// Delete a screenshot
app.delete('/api/screenshots/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req.query

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' })
    }

    const [deleted] = await db
      .delete(screenshots)
      .where(and(eq(screenshots.id, id), eq(screenshots.userId, userId)))
      .returning()

    if (!deleted) {
      return res.status(404).json({ error: 'Screenshot not found' })
    }

    res.json({ success: true, id })
  } catch (err) {
    console.error('[Lynkeus] failed to delete screenshot:', err)
    res.status(500).json({ error: 'Failed to delete screenshot' })
  }
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Lynkeus backend running on http://localhost:${PORT}`)
})
