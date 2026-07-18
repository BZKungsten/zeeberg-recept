import { githubApi, encode } from './_github.js'

const RECIPES_DIR = 'recipes'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const listRes = await githubApi(RECIPES_DIR)
    if (!listRes.ok) return res.json([])

    const files = await listRes.json()
    const mdFiles = files.filter(f => f.name.endsWith('.md'))

    const recipes = await Promise.all(mdFiles.map(async (f) => {
      const contentRes = await fetch(f.download_url, {
        headers: { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` }
      })
      const content = await contentRes.text()
      const imageMatch = content.match(/!\[.*?\]\((\.\.\/RecipeImages\/[^)]+)\)/)
      const image = imageMatch ? imageMatch[1] : null
      return { id: f.name, title: f.name.replace('.md', ''), content, image }
    }))

    return res.json(recipes)
  }

  if (req.method === 'POST') {
    const { title, content, recipeContent } = req.body
    const finalContent = content || recipeContent
    if (!title || !finalContent) return res.status(400).json({ error: 'Missing fields' })

    const fileName = `${title.replace(/[^a-z0-9åäöÅÄÖ]/gi, '_')}.md`
    const putRes = await githubApi(`${RECIPES_DIR}/${encodeURIComponent(fileName)}`, {
      method: 'PUT',
      body: JSON.stringify({ message: `Add recipe: ${fileName}`, content: encode(finalContent), branch: 'main' })
    })

    if (!putRes.ok) {
      const ghErr = await putRes.json().catch(() => ({}))
      const debugUrl = `repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${RECIPES_DIR}/${fileName}`
      return res.status(500).json({ error: `GitHub ${putRes.status}: ${ghErr.message || '?'} | URL: ${debugUrl}` })
    }
    return res.status(201).json({ message: 'Saved', id: fileName })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
