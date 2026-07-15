import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { usageDaily } from '../db/schema.js'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string)
const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })

const DAILY_LIMIT = 10

function todayDateString() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

router.get('/usage', async (req, res) => {
  const userId = req.query.userId
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' })
  }

  const today = todayDateString()

  try {
    const existing = await db
      .select()
      .from(usageDaily)
      .where(and(eq(usageDaily.userId, userId), eq(usageDaily.usageDate, today)))
      .limit(1)

    res.json({ used: existing[0]?.count ?? 0, limit: DAILY_LIMIT })
  } catch (err) {
    console.error('[Usage] failed:', err)
    res.status(500).json({ error: 'Failed to fetch usage' })
  }
})

router.post('/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' })
  }

  const userId = req.body.userId
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' })
  }

  const today = todayDateString()

  try {
    // Atomically reserve a slot in one statement. This is what makes it
    // safe under concurrency ("convert all" firing 5 requests at once) —
    // the increment and the limit check happen together in the database,
    // so two concurrent requests can't both read count=3 and both write
    // count=4.
    const reserved = await db.execute(sql`
      INSERT INTO usage_daily (user_id, usage_date, count)
      VALUES (${userId}, ${today}, 1)
      ON CONFLICT (user_id, usage_date)
      DO UPDATE SET count = usage_daily.count + 1
      WHERE usage_daily.count < ${DAILY_LIMIT}
      RETURNING count
    `)

    if (reserved.rows.length === 0) {
      const existing = await db
        .select()
        .from(usageDaily)
        .where(and(eq(usageDaily.userId, userId), eq(usageDaily.usageDate, today)))
        .limit(1)
      return res.status(429).json({
        error: 'Daily free limit reached',
        limit: DAILY_LIMIT,
        used: existing[0]?.count ?? DAILY_LIMIT,
      })
    }

    const newCount = (reserved.rows[0] as { count: number }).count

    try {
      // Resize to keep token usage low.
      const resized = await sharp(req.file.buffer)
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()

      const base64Image = resized.toString('base64')

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg',
          },
        },
        {
          text: 'Transcribe all visible text in this image exactly as it appears, preserving line breaks and layout structure. Return only the transcribed text, no commentary or explanation.',
        },
      ])

      let text = result.response.text().trim()
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

      res.json({ text, usage: { used: newCount, limit: DAILY_LIMIT } })
    } catch (ocrErr) {
      // OCR failed after we already reserved a slot — give it back so a
      // transient failure doesn't unfairly eat into the user's quota.
      await db
        .update(usageDaily)
        .set({ count: sql`${usageDaily.count} - 1` })
        .where(and(eq(usageDaily.userId, userId), eq(usageDaily.usageDate, today)))
      throw ocrErr
    }
  } catch (err) {
    console.error('[OCR] failed:', err)
    res.status(500).json({ error: 'OCR failed' })
  }
})

export default router