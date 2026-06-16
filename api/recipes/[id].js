import { githubApi, getFileSha, encode } from '../_github.js'

const RECIPES_DIR = 'recipes'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'PUT') {
    const { title, content } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })

    const oldFileName = id
    const newFileName = `${title.replace(/[^a-z0-9åäöÅÄÖ]/gi, '_')}.md`

    if (oldFileName !== newFileName) {
      const oldSha = await getFileSha(`${RECIPES_DIR}/${oldFileName}`)
      if (oldSha) {
        await githubApi(`${RECIPES_DIR}/${oldFileName}`, {
          method: 'DELETE',
          body: JSON.stringify({ message: `Rename: ${oldFileName}`, sha: oldSha })
        })
      }
    }

    const sha = await getFileSha(`${RECIPES_DIR}/${newFileName}`)
    const body = { message: `Update: ${newFileName}`, content: encode(content) }
    if (sha) body.sha = sha

    const putRes = await githubApi(`${RECIPES_DIR}/${newFileName}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })

    if (!putRes.ok) return res.status(500).json({ error: 'Failed to update' })
    return res.json({ message: 'Updated', id: newFileName })
  }

  if (req.method === 'DELETE') {
    const sha = await getFileSha(`${RECIPES_DIR}/${id}`)
    if (!sha) return res.status(404).json({ error: 'Not found' })

    const delRes = await githubApi(`${RECIPES_DIR}/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ message: `Delete: ${id}`, sha })
    })

    if (!delRes.ok) return res.status(500).json({ error: 'Failed to delete' })
    return res.json({ message: 'Deleted' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
