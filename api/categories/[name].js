import { githubApi, decode, encode } from '../_github.js'

const RECIPES_DIR = 'recipes'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const name = req.query.name

  // Update hidden_tags.json
  const hiddenRes = await githubApi('hidden_tags.json')
  let hidden = []
  let hiddenSha = undefined

  if (hiddenRes.ok) {
    const hiddenFile = await hiddenRes.json()
    hiddenSha = hiddenFile.sha
    try { hidden = JSON.parse(decode(hiddenFile.content)) } catch {}
  }

  if (!hidden.includes(name)) {
    hidden.push(name)
    const body = { message: `Hide tag: ${name}`, content: encode(JSON.stringify(hidden)) }
    if (hiddenSha) body.sha = hiddenSha
    await githubApi('hidden_tags.json', { method: 'PUT', body: JSON.stringify(body) })
  }

  // Remove tag from all recipe files
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
          body: JSON.stringify({
            message: `Remove tag #${name} from ${f.name}`,
            content: encode(updated),
            sha: f.sha
          })
        })
      }
    }))
  }

  return res.json({ message: 'Hidden' })
}
