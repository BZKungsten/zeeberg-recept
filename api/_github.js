const BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents`

export function githubApi(path, options = {}) {
  return fetch(`${BASE}/${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    }
  })
}

export async function getFileSha(path) {
  const res = await githubApi(path)
  if (!res.ok) return null
  const data = await res.json()
  return data.sha
}

export function decode(base64) {
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export function encode(text) {
  return Buffer.from(text).toString('base64')
}
