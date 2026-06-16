export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL krävs' })

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZeebergRecept/1.0)' }
    })
    if (!response.ok) return res.status(422).json({ error: 'Kunde inte öppna sidan' })
    const html = await response.text()

    const jsonLdMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    let recipe = null

    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          const types = [].concat(item['@type'] || [])
          if (types.includes('Recipe')) { recipe = item; break }
          if (item['@graph']) {
            const r = item['@graph'].find(g => [].concat(g['@type'] || []).includes('Recipe'))
            if (r) { recipe = r; break }
          }
        }
        if (recipe) break
      } catch {}
    }

    if (!recipe) return res.status(422).json({ error: 'Kunde inte hitta receptdata på denna sida. Fungerar bäst på Köket.se, Arla, ICA, Tasteline.' })

    const title = recipe.name || ''

    let image = null
    if (recipe.image) {
      if (typeof recipe.image === 'string') image = recipe.image
      else if (Array.isArray(recipe.image)) image = typeof recipe.image[0] === 'string' ? recipe.image[0] : recipe.image[0]?.url
      else if (recipe.image.url) image = recipe.image.url
    }

    const formatDuration = (iso) => {
      if (!iso) return null
      const h = iso.match(/(\d+)H/)?.[1]
      const m = iso.match(/(\d+)M/)?.[1]
      if (h && m) return `${h} h ${m} min`
      if (h) return `${h} h`
      if (m) return `${m} min`
      return null
    }

    let content = ''
    if (recipe.description) content += `${recipe.description}\n\n`

    const times = []
    const prep = formatDuration(recipe.prepTime)
    const cook = formatDuration(recipe.cookTime)
    const total = formatDuration(recipe.totalTime)
    if (prep) times.push(`Prep: ${prep}`)
    if (cook) times.push(`Tillagning: ${cook}`)
    if (total) times.push(`Total: ${total}`)
    if (times.length) content += times.join(' | ') + '\n\n'

    if (recipe.recipeYield) {
      const y = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield
      content += `Portioner: ${y}\n\n`
    }

    if (recipe.recipeIngredient?.length) {
      content += `Ingredienser:\n${recipe.recipeIngredient.map(i => `- ${i}`).join('\n')}\n\n`
    }

    if (recipe.recipeInstructions?.length) {
      content += `Instruktioner:\n`
      recipe.recipeInstructions.forEach((step, i) => {
        const text = typeof step === 'string' ? step : step.text || ''
        if (text) content += `${i + 1}. ${text}\n`
      })
    }

    res.json({ title, content: content.trim(), image })
  } catch {
    res.status(500).json({ error: 'Kunde inte hämta sidan. Kontrollera att URL:en är korrekt.' })
  }
}
