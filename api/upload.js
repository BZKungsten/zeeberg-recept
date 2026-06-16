import { githubApi } from './_github.js'

const IMAGES_DIR = 'RecipeImages'

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { filename, data, contentType } = req.body
  if (!filename || !data) return res.status(400).json({ error: 'Missing data' })

  const ext = contentType?.includes('png') ? '.png' : contentType?.includes('webp') ? '.webp' : '.jpg'
  const newFilename = `${Date.now()}${ext}`

  const putRes = await githubApi(`${IMAGES_DIR}/${newFilename}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add image: ${newFilename}`,
      content: data
    })
  })

  if (!putRes.ok) return res.status(500).json({ error: 'Failed to upload' })
  return res.json({ url: `../RecipeImages/${newFilename}` })
}
