import express from 'express'
import { eq } from 'drizzle-orm'
import { getAuth } from '@clerk/express'
import { db } from '../db/index.js'
import { userOnboarding } from '../db/schema.js'

const router = express.Router()

// Fetch (and lazily create) onboarding status for a user
router.get('/onboarding', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const existing = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1)

    if (existing[0]) {
      return res.json({ completed: existing[0].completed, currentStep: existing[0].currentStep })
    }

    const [created] = await db.insert(userOnboarding).values({ userId }).returning()
    res.json({ completed: created.completed, currentStep: created.currentStep })
  } catch (err) {
    console.error('[Onboarding] failed to fetch status:', err)
    res.status(500).json({ error: 'Failed to fetch onboarding status' })
  }
})

// Mark onboarding complete for a user
router.post('/onboarding/complete', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const [updated] = await db
      .insert(userOnboarding)
      .values({ userId, completed: true, completedAt: new Date() })
      .onConflictDoUpdate({
        target: userOnboarding.userId,
        set: { completed: true, completedAt: new Date() },
      })
      .returning()

    res.json({ completed: updated.completed })
  } catch (err) {
    console.error('[Onboarding] failed to mark complete:', err)
    res.status(500).json({ error: 'Failed to complete onboarding' })
  }
})

export default router