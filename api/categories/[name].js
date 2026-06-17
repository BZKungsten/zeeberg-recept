import { githubApi, decode, encode } from '../_github.js'

const RECIPES_DIR = 'recipes'
const CATS_FILE = 'categories.json'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const name = req.query.name

  // Remove from categories.json
  const catsRes = await githubApi(CATS_FILE)
  if (catsRes.ok) {
    const catsFile = await catsRes.json()
    try {
      const cats = JSON.parse(decode(catsFile.content)).filter(c => c !== name)
      await githubApi(CATS_FILE, {
        method: 'PUT',
        body: JSON.stringify({ message: `Remove category: ${name}`, content: encode(JSON.stringify(cats)), sha: catsFile.sha, branch: 'main' })
      })
    } catch {}
  }

  // Strip #tag from all recipe files
  const listRes = await githubApi(RECIPES_DIR)
  if (listRes.ok) {
    const files = await listRes.json()
    const tagRegex = new RegExp(`\\s*#${name}(?=\\s|$)`, 'g')

    await Promise.all(files.filter(f => f.name.endsWith('.md')).map(async (f) => {
      const contentRes = await fetch(f.download_url, {
        headers: { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` }
      })
      const original = await contentRes.text()
      const updated = original.replace(tagRegex, '').replace(/\n\n\n+/g, '\n\n').trimEnd()

      if (updated !== original) {
        await githubApi(`${RECIPES_DIR}/${f.name}`, {
          method: 'PUT',
          body: JSON.stringify({ message: `Remove tag #${name} from ${f.name}`, content: encode(updated), sha: f.sha, branch: 'main' })
        })
      }
    }))
  }

  return res.json({ message: 'Deleted' })
}
