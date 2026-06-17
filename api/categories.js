import { githubApi, decode, encode } from './_github.js'

const CATS_FILE = 'categories.json'

async function readCategories() {
  const res = await githubApi(CATS_FILE)
  if (!res.ok) return { cats: [], sha: null }
  const data = await res.json()
  try { return { cats: JSON.parse(decode(data.content)), sha: data.sha } } catch { return { cats: [], sha: data.sha } }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { cats } = await readCategories()
    return res.json(cats)
  }

  if (req.method === 'POST') {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })

    const { cats, sha } = await readCategories()
    if (cats.includes(name)) return res.json({ message: 'Already exists' })

    const newCats = [...cats, name].sort()
    const body = { message: `Add category: ${name}`, content: encode(JSON.stringify(newCats)), branch: 'main' }
    if (sha) body.sha = sha

    const putRes = await githubApi(CATS_FILE, { method: 'PUT', body: JSON.stringify(body) })
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}))
      return res.status(500).json({ error: err.message || 'Failed to save' })
    }
    return res.status(201).json({ message: 'Added', categories: newCats })
  }

  res.status(405).end()
}
