import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { clerkMiddleware, getAuth } from '@clerk/express'
import { db } from './db/index.js'
import { screenshots } from './db/schema.js'
import { desc, eq, and } from 'drizzle-orm'
import ocrRouter from './routes/ocr.js'
import onboardingRouter from './routes/onboarding.js'
import feedbackRouter from './routes/feedback.js'
import uploadRouter from './routes/upload.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(clerkMiddleware())
app.use('/api', ocrRouter)
app.use('/api', onboardingRouter)
app.use('/api', feedbackRouter)
app.use('/api', uploadRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Save a new screenshot's extracted text
app.post('/api/screenshots', async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const { extractedText, tag, fileName, imageData } = req.body

    if (!userId || !extractedText) {
      return res.status(400).json({ error: 'extractedText is required' })
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
    const { userId } = getAuth(req)
    const { search } = req.query

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const results = await db
      .select()
      .from(screenshots)
      .where(eq(screenshots.userId, userId))
      .orderBy(desc(screenshots.createdAt))

    const filtered = search && typeof search === 'string'
      ? results.filter((r) => r.extractedText.toLowerCase().includes(search.toLowerCase()))
      : results

    res.json(filtered)
  } catch (err) {
    console.error('[Lynkeus] failed to fetch screenshots:', err)
    res.status(500).json({ error: 'Failed to fetch screenshots' })
  }
})

// Rename (or clear) a screenshot's title
app.patch('/api/screenshots/:id', async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const id = req.params.id as string
    const { title } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' })
    }

    const trimmed = title.trim().slice(0, 120)

    const [updated] = await db
      .update(screenshots)
      .set({ title: trimmed || null })
      .where(and(eq(screenshots.id, id), eq(screenshots.userId, userId)))
      .returning()

    if (!updated) {
      return res.status(404).json({ error: 'Screenshot not found' })
    }

    res.json(updated)
  } catch (err) {
    console.error('[Lynkeus] failed to update screenshot title:', err)
    res.status(500).json({ error: 'Failed to update title' })
  }
})

// Delete a screenshot
app.delete('/api/screenshots/:id', async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const id = req.params.id as string

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
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

export default app