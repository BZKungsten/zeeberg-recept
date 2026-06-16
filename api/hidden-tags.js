import { githubApi, decode } from './_github.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const fileRes = await githubApi('hidden_tags.json')
    if (!fileRes.ok) return res.json([])
    const file = await fileRes.json()
    try {
      return res.json(JSON.parse(decode(file.content)))
    } catch {
      return res.json([])
    }
  }
  res.status(405).json({ error: 'Method not allowed' })
}
