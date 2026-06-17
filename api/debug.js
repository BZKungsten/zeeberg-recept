export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN || ''
  const owner = process.env.GITHUB_OWNER || ''
  const repo = process.env.GITHUB_REPO || ''

  const testRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const testData = await testRes.json()

  res.json({
    token_prefix: token.slice(0, 8) + '...',
    owner,
    repo,
    github_status: testRes.status,
    permissions: testData.permissions || testData.message
  })
}
