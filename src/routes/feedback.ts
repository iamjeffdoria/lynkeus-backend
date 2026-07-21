import express, { Router } from 'express'
import { getAuth } from '@clerk/express'
import { db } from '../db/index.js'
import { feedback } from '../db/schema.js'
import { desc } from 'drizzle-orm'

const router: Router = express.Router()

router.post('/feedback', async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const { category, message, rating, pageContext } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' })
    }

    const validCategories = ['bug', 'idea', 'general']
    const safeCategory = validCategories.includes(category) ? category : 'general'
    const safeRating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null

    const [saved] = await db
      .insert(feedback)
      .values({
        userId,
        category: safeCategory,
        message: message.trim().slice(0, 2000),
        rating: safeRating,
        pageContext: pageContext ?? null,
      })
      .returning()

    res.status(201).json(saved)
  } catch (err) {
    console.error('[Lynkeus] failed to save feedback:', err)
    res.status(500).json({ error: 'Failed to save feedback' })
  }
})

router.get('/feedback', async (req, res) => {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (userId !== process.env.ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const results = await db.select().from(feedback).orderBy(desc(feedback.createdAt))
    res.json(results)
  } catch (err) {
    console.error('[Lynkeus] failed to fetch feedback:', err)
    res.status(500).json({ error: 'Failed to fetch feedback' })
  }
})

export default router