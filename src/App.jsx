import { useState, useEffect, useRef } from 'react'
import { UtensilsCrossed, Plus, Grid3x3, List, Search, X, Share2, CheckCircle2, Trash2, Camera, ImagePlus, Pencil, Check } from 'lucide-react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import './App.css'

const API_BASE = ''

const GITHUB_CDN_BASE = import.meta.env.VITE_GITHUB_OWNER
  ? `https://cdn.jsdelivr.net/gh/${import.meta.env.VITE_GITHUB_OWNER}/${import.meta.env.VITE_GITHUB_REPO}@main`
  : ''

const toDisplayUrl = (url) => {
  if (!url) return null
  if (url.startsWith('../RecipeImages/')) {
    const filename = url.slice(16)
    return GITHUB_CDN_BASE ? `${GITHUB_CDN_BASE}/RecipeImages/${filename}` : `/images/${filename}`
  }
  return url
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => resolve(e.target.result.split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const getCroppedBlob = (image, crop) =>
  new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    canvas.width = Math.round(crop.width * scaleX)
    canvas.height = Math.round(crop.height * scaleY)
    canvas.getContext('2d').drawImage(
      image,
      crop.x * scaleX, crop.y * scaleY,
      crop.width * scaleX, crop.height * scaleY,
      0, 0, canvas.width, canvas.height
    )
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  })


function App() {
  const [activeTab, setActiveTab] = useState('recipes')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState([])
  const [editCustomTag, setEditCustomTag] = useState('')
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [editImageUrl, setEditImageUrl] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)
  const [editError, setEditError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [cropState, setCropState] = useState(null)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const imgRef = useRef(null)
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    socialUrl: '',
    photoUrl: '',
    content: '',
    tags: [],
    newCustomTag: '' // För att kunna skriva in helt egna taggar
  })

  // Fetch recipes from server
  const fetchRecipes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/recipes`)
      const data = await response.json()

      const processedRecipes = data.map((file, index) => {
        // Extrahera hashtaggar (både #Tag och de som lagts till i filen)
        const hashtags = (file.content.match(/#[\wÅÄÖåäö]+/g) || [])
          .map(tag => tag.substring(1))
          .filter((tag, idx, self) => self.indexOf(tag) === idx)

        // Extrahera bild om den sparats i Markdown-format ![alt](url)
        const imageMatch = file.content.match(/!\[.*?\]\((.*?)\)/)
        let imageUrl = toDisplayUrl(imageMatch ? imageMatch[1] : null)

        // Om ingen bild finns, genererar vi en stabil sökning via Unsplash Source API (via pexels/unsplash fungerande länk)
        if (!imageUrl) {
          imageUrl = `https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&auto=format&fit=crop&q=80`
        }

        // Städa bort metadata-linjer från förhandsgranskningen av innehållet
        const cleanContent = file.content
          .replace(/!\[.*?\]\((.*?)\)/g, '') // Ta bort bilder
          .replace(/\[Källa:.*?\]/g, '')     // Ta bort källor
          .replace(/#[\wÅÄÖåäö]+/g, '')
          .trim()

        return {
          id: file.id || index,
          name: (file.title || file.id || '').replace(/\.md$/i, ''),
          content: cleanContent.substring(0, 90) + (cleanContent.length > 90 ? '...' : ''),
          fullContent: file.content,
          tags: hashtags,
          image: imageUrl,
          addedDate: new Date().toLocaleDateString('sv-SE')
        }
      })

      setRecipes(processedRecipes)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recipes:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecipes()
    fetch(`${API_BASE}/api/categories`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setCategories(data))
      .catch(() => {})
  }, [])

  const allTags = Array.from(
    new Set([...categories, ...recipes.flatMap(r => r.tags)])
  ).sort()

  const getTagColor = () => 'bg-[#f0f5f0] text-[#4a6e4a] border border-[#9ab89a]'

  const handleToggleFormTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }))
  }

  const handleAddCustomTag = (e) => {
    e.preventDefault()
    const cleanTag = formData.newCustomTag.trim().replace(/\s+/g, '_')
    if (!cleanTag) return
    if (!allTags.includes(cleanTag)) {
      setCategories(prev => [...prev, cleanTag].sort())
      fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanTag })
      }).catch(() => {})
    }
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(cleanTag) ? prev.tags : [...prev.tags, cleanTag],
      newCustomTag: ''
    }))
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setImportLoading(true)
    setImportError(null)
    try {
      const res = await fetch(`${API_BASE}/api/fetch-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() })
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || 'Något gick fel'); return }
      setFormData(prev => ({ ...prev, name: data.title || prev.name, content: data.content || prev.content, photoUrl: data.image || prev.photoUrl }))
      if (data.image) setImagePreview(data.image)
      setImportUrl('')
    } catch {
      setImportError('Kunde inte hämta receptet.')
    } finally {
      setImportLoading(false)
    }
  }

  const handleAddRecipe = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.content) {
      setSubmitError('Vänligen fyll i både namn och recepttext.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      let finalPhotoUrl = formData.photoUrl
      if (imageFile) {
        const base64 = await fileToBase64(imageFile)
        const uploadRes = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: imageFile.name, data: base64, contentType: imageFile.type })
        })
        if (!uploadRes.ok) throw new Error('Kunde inte ladda upp bilden')
        const { url } = await uploadRes.json()
        finalPhotoUrl = url
      }

      let recipeContent = ''

      if (finalPhotoUrl) {
        recipeContent += `![Receptbild](${finalPhotoUrl})\n\n`
      }
      
      recipeContent += formData.content
      
      if (formData.socialUrl) {
        recipeContent += `\n\n[Källa: ${formData.socialUrl}]`
      }

      if (formData.tags.length > 0) {
        recipeContent += `\n\n${formData.tags.map(tag => `#${tag}`).join(' ')}`
      }

      const response = await fetch(`${API_BASE}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.name,
          content: recipeContent
        })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Serverfel ${response.status}`)
      }

      setFormData({ name: '', socialUrl: '', photoUrl: '', tags: [], content: '', newCustomTag: '' })
      setImageFile(null)
      setImagePreview(null)
      setShowAddForm(false)
      fetchRecipes()
    } catch (error) {
      console.error(error)
      setSubmitError(error.message || 'Kunde inte spara receptet.')
    } finally {
      setSubmitting(false)
    }
  }

  const addCategory = async () => {
    const t = newCategoryInput.trim().replace(/\s+/g, '_')
    if (!t || allTags.includes(t)) { setNewCategoryInput(''); return }
    setCategories(prev => [...prev, t].sort())
    setNewCategoryInput('')
    fetch(`${API_BASE}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t })
    }).catch(() => {})
  }

  const handleDeleteCategory = async (tag) => {
    setCategories(prev => prev.filter(c => c !== tag))
    setSelectedTags(prev => prev.filter(t => t !== tag))
    setRecipes(prev => prev.map(r => ({ ...r, tags: r.tags.filter(t => t !== tag) })))
    fetch(`${API_BASE}/api/categories/${encodeURIComponent(tag)}`, { method: 'DELETE' })
      .then(() => fetchRecipes())
      .catch(() => {})
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) { setEditError('Receptnamn krävs'); return }
    setEditError(null)
    try {
      let finalImageUrl = editImageUrl
      if (editImageFile) {
        const base64 = await fileToBase64(editImageFile)
        const uploadRes = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: editImageFile.name, data: base64, contentType: editImageFile.type })
        })
        if (!uploadRes.ok) throw new Error('Kunde inte ladda upp bilden')
        const { url } = await uploadRes.json()
        finalImageUrl = url
      }
      let finalContent = ''
      if (finalImageUrl) finalContent += `![Receptbild](${finalImageUrl})\n\n`
      finalContent += editContent.trim()
      if (editTags.length > 0) finalContent += `\n\n${editTags.map(t => `#${t}`).join(' ')}`

      const response = await fetch(`${API_BASE}/api/recipes/${encodeURIComponent(selectedRecipe.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), content: finalContent })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Serverfel ${response.status}`)
      }
      setIsEditing(false)
      setSelectedRecipe(null)
      fetchRecipes()
    } catch (error) {
      console.error(error)
      setEditError(error.message || 'Något gick fel')
    }
  }

  const handleDeleteRecipe = async (recipe) => {
    try {
      const response = await fetch(`${API_BASE}/api/recipes/${encodeURIComponent(recipe.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Kunde inte radera')
      setSelectedRecipe(null)
      setConfirmDelete(false)
      fetchRecipes()
    } catch (error) {
      console.error(error)
    }
  }

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.fullContent.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => recipe.tags.includes(tag))
    return matchesSearch && matchesTags
  })

  return (
    <div className="bg-slate-50 h-screen overflow-y-auto pb-28">
      {/* Header - Receptfliken */}
      {activeTab === 'recipes' && (
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="px-6 py-6">
            <div className="mb-4">
              <h1 className="text-2xl font-black tracking-[0.2em] uppercase" style={{fontFamily: "'Montserrat', sans-serif"}}><span className="text-slate-900">ZEEBERG </span><span className="text-[#6B8C6B]">RECEPT</span></h1>
              <p className="text-sm text-slate-500 mt-1">Familjens sparade mat- och drycktips</p>
            </div>
            <div className="relative">
              <Search size={20} className="absolute left-4 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök på ingrediens, titel, tagg..."
                className="w-full pl-12 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8C6B]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header - Kategorifliken */}
      {(activeTab === 'categories-grid' || activeTab === 'categories-list') && (
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="px-6 py-6">
            <h1 className="text-4xl font-bold text-slate-900">Kategorier</h1>
            <p className="text-sm text-slate-500 mt-1">Filtrera på maträtter och tillfällen</p>
          </div>
        </div>
      )}

      {/* Receptlista */}
      {activeTab === 'recipes' && (
        <div className="px-4 py-6">
          {loading ? (
            <div className="text-center py-20"><p className="text-slate-600">Hämtar recept...</p></div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Inga recept hittades</h2>
              <p className="text-slate-500 mb-6">Skapa ett nytt recept eller rensa din sökning.</p>
              <button onClick={() => setShowAddForm(true)} className="px-6 py-3 bg-[#6B8C6B] text-white rounded-2xl font-semibold">
                Lägg till första receptet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all"
                >
                  <div className="relative h-56 bg-slate-200">
                    <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover object-center" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&auto=format&fit=crop&q=80' }} />
                    <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const imageMatch = recipe.fullContent.match(/!\[.*?\]\((.*?)\)/)
                          setEditTitle(recipe.name)
                          setEditContent(recipe.fullContent.replace(/!\[.*?\]\(.*?\)\n\n?/, '').replace(/\s*\n\n(#[\wÅÄÖåäö]+ *)+$/, '').trim())
                          setEditTags([...recipe.tags])
                          setEditImageUrl(imageMatch ? imageMatch[1] : null)
                          setEditImageFile(null)
                          setEditImagePreview(null)
                          setEditCustomTag('')
                          setSelectedRecipe(recipe)
                          setIsEditing(true)
                        }}
                        className="p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all text-slate-700"
                      ><Pencil size={15} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedRecipe(recipe); setConfirmDelete(true) }}
                        className="p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all text-red-500"
                      ><Trash2 size={15} /></button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (navigator.share) { navigator.share({ title: recipe.name, text: recipe.name }) }
                          else { navigator.clipboard?.writeText(recipe.name) }
                        }}
                        className="p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all text-slate-700"
                      ><Share2 size={15} /></button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">{recipe.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{recipe.content}</p>
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.map(tag => (
                        <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kategorifliken Content */}
      {/* Kategorier - rutnät (gamla vyn) */}
      {activeTab === 'categories-grid' && (
        <div className="px-4 py-6">
          {confirmDeleteCategory && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-4">
              <p className="text-sm text-red-700 font-medium">Ta bort kategorin "#{confirmDeleteCategory}"?</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setConfirmDeleteCategory(null)} className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl">Avbryt</button>
                <button onClick={() => { handleDeleteCategory(confirmDeleteCategory); setConfirmDeleteCategory(null) }} className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-xl">Ja, ta bort</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2.5 mb-8">
            {allTags.map((tag) => {
              const isActive = selectedTags.includes(tag)
              const count = recipes.filter(r => r.tags.includes(tag)).length
              return (
                <div key={tag} className={`flex items-center rounded-2xl border transition-all ${isActive ? 'bg-[#6B8C6B] border-[#6B8C6B] shadow-sm' : 'bg-white border-slate-200'}`}>
                  <button onClick={() => setSelectedTags(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 ${isActive ? 'text-white' : 'text-slate-700'}`}>
                    <span>#{tag}</span>
                    <span className="text-xs opacity-60">({count})</span>
                  </button>
                  <button onClick={() => setConfirmDeleteCategory(tag)} className={`pr-3 pl-1 py-3 transition-colors ${isActive ? 'text-[#b8cbb8] hover:text-white' : 'text-slate-300 hover:text-red-400'}`}>
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 mb-6">
            <input type="text" value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }} placeholder="Ny kategori..." className="flex-1 p-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#6B8C6B] text-sm" />
            <button type="button" onClick={addCategory} className="px-4 py-3 bg-[#6B8C6B] text-white rounded-2xl font-semibold text-sm">Lägg till</button>
          </div>
          {selectedTags.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Resultat ({filteredRecipes.length})</h2>
                <button onClick={() => setSelectedTags([])} className="text-sm text-[#6B8C6B] font-semibold">Rensa filter</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredRecipes.map(recipe => (
                  <div key={recipe.id} onClick={() => setSelectedRecipe(recipe)} className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-4 cursor-pointer">
                    <img src={recipe.image} className="w-20 h-20 object-cover rounded-xl bg-slate-100" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&auto=format&fit=crop&q=80' }} />
                    <div>
                      <h4 className="font-bold text-slate-900">{recipe.name}</h4>
                      <div className="flex flex-wrap gap-1 mt-2">{recipe.tags.map(t => <span key={t} className="text-xs text-slate-500">#{t}</span>)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kategorier - lista (nya vyn) */}
      {activeTab === 'categories-list' && (
        <div className="flex h-[calc(100vh-160px)]">
          {/* Vänster: kategorilista */}
          <div className="w-2/5 border-r border-slate-200 bg-white overflow-y-auto flex flex-col">
            <div className="flex-1">
              {allTags.map(tag => {
                const isActive = selectedCategory === tag
                const count = recipes.filter(r => r.tags.includes(tag)).length
                return (
                  <div key={tag} className={`flex items-center border-l-4 transition-all ${isActive ? 'border-[#6B8C6B] bg-slate-50' : 'border-transparent'}`}>
                    <button onClick={() => setSelectedCategory(tag)} className="flex-1 px-3 py-3 text-left min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-[#4a6e4a]' : 'text-slate-700'}`}>{tag}</p>
                      <p className="text-xs text-slate-400">{count} recept</p>
                    </button>
                    <button onClick={() => setConfirmDeleteCategory(tag)} className="pr-3 shrink-0 text-slate-200 hover:text-red-400 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-slate-100 p-2 flex gap-1 shrink-0">
              <input
                value={newCategoryInput}
                onChange={e => setNewCategoryInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                placeholder="Ny kategori..."
                className="flex-1 px-2 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-[#6B8C6B]"
              />
              <button onClick={addCategory} className="px-3 py-1.5 bg-[#6B8C6B] text-white rounded-xl text-xs font-bold">+</button>
            </div>
          </div>

          {/* Höger: recept i vald kategori */}
          <div className="flex-1 overflow-y-auto bg-slate-50">
            {confirmDeleteCategory && (
              <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3">
                <p className="text-xs text-red-700 font-medium">Ta bort "#{confirmDeleteCategory}"?</p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmDeleteCategory(null)} className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg">Avbryt</button>
                  <button onClick={() => { handleDeleteCategory(confirmDeleteCategory); setConfirmDeleteCategory(null); if (selectedCategory === confirmDeleteCategory) setSelectedCategory(null) }} className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg">Ta bort</button>
                </div>
              </div>
            )}
            {!selectedCategory ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm px-4 text-center">Välj en kategori till vänster</div>
            ) : (
              recipes.filter(r => r.tags.includes(selectedCategory)).length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">Inga recept i denna kategori</div>
              ) : (
                recipes.filter(r => r.tags.includes(selectedCategory)).map(recipe => (
                  <button key={recipe.id} onClick={() => setSelectedRecipe(recipe)}
                    className="w-full px-4 py-3 border-b border-slate-100 bg-white text-left active:bg-slate-50 transition-colors">
                    <p className="text-sm font-medium text-slate-900 leading-snug">{recipe.name.replace(/_/g, ' ')}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {recipe.tags.filter(t => t !== selectedCategory).map(t => (
                        <span key={t} className="text-xs text-slate-400">#{t}</span>
                      ))}
                    </div>
                  </button>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Detaljmodal för ett recept */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center animate-fade-in" onClick={() => { setSelectedRecipe(null); setConfirmDelete(false); setIsEditing(false) }}>
          <div className="w-full h-[92vh] sm:max-w-2xl sm:max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              {isEditing
                ? <input value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={50} className="text-base font-bold text-slate-900 border-b-2 border-[#6B8C6B] outline-none flex-1 mr-3 bg-transparent" />
                : <h2 className="text-base font-bold text-slate-900 truncate min-w-0 flex-1 mr-3">{selectedRecipe.name}</h2>
              }
              <div className="flex gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button type="button" onClick={handleSaveEdit} className="p-2 bg-[#6B8C6B] text-white hover:bg-[#5a7a5a] rounded-full transition-colors"><Check size={20} /></button>
                    <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => {
                      const imageMatch = selectedRecipe.fullContent.match(/!\[.*?\]\((.*?)\)/)
                      setEditTitle(selectedRecipe.name)
                      setEditContent(selectedRecipe.fullContent
                        .replace(/!\[.*?\]\(.*?\)\n\n?/, '')
                        .replace(/\s*\n\n(#[\wÅÄÖåäö]+ *)+$/, '')
                        .trim())
                      setEditTags([...selectedRecipe.tags])
                      setEditImageUrl(imageMatch ? imageMatch[1] : null)
                      setEditImageFile(null)
                      setEditImagePreview(null)
                      setEditCustomTag('')
                      setIsEditing(true)
                    }} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><Pencil size={20} /></button>
                    <button onClick={() => setConfirmDelete(true)} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-full transition-colors"><Trash2 size={20} /></button>
                    <button onClick={() => { setSelectedRecipe(null); setConfirmDelete(false); setIsEditing(false) }} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              {confirmDelete && !isEditing && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-4">
                  <p className="text-sm text-red-700 font-medium">Radera "{selectedRecipe.name}"?</p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl">Avbryt</button>
                    <button onClick={() => handleDeleteRecipe(selectedRecipe)} className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-xl">Ja, radera</button>
                  </div>
                </div>
              )}
              {editImagePreview || editImageUrl || (!isEditing && selectedRecipe.image) ? (
                <div className="relative w-full">
                  <img
                    src={isEditing ? (editImagePreview || toDisplayUrl(editImageUrl)) : selectedRecipe.image}
                    className="w-full h-64 object-cover rounded-2xl"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&auto=format&fit=crop&q=80' }}
                  />
                  {isEditing && (
                    <>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl cursor-pointer">
                        <span className="text-white text-sm font-semibold bg-black/50 px-3 py-1.5 rounded-xl">Byt bild</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const f = e.target.files[0]
                          if (!f) return
                          setCrop(undefined); setCompletedCrop(null)
                          setCropState({ src: URL.createObjectURL(f), originalName: f.name, onConfirm: (file) => {
                            setEditImageFile(file)
                            setEditImagePreview(URL.createObjectURL(file))
                            setCropState(null)
                          }})
                        }} />
                      </label>
                      <button type="button" onClick={() => { setEditImageFile(null); setEditImagePreview(null); setEditImageUrl(null) }} className="absolute top-2 right-2 bg-white/80 rounded-full p-1.5"><X size={16} /></button>
                    </>
                  )}
                </div>
              ) : isEditing ? (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                  <Camera size={28} className="text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500">Lägg till bild</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files[0]
                    if (!f) return
                    setCrop(undefined); setCompletedCrop(null)
                    setCropState({ src: URL.createObjectURL(f), originalName: f.name, onConfirm: (file) => {
                      setEditImageFile(file)
                      setEditImagePreview(URL.createObjectURL(file))
                      setCropState(null)
                    }})
                  }} />
                </label>
              ) : null}
              {isEditing ? (
                <>
                  {editError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{editError}</div>}
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={12} className="w-full p-4 text-sm text-slate-700 bg-slate-50 border border-[#9ab89a] rounded-2xl outline-none focus:ring-2 focus:ring-[#6B8C6B] resize-none" />
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Kategorier</label>
                    <div className="flex flex-wrap gap-1.5 p-2 border rounded-xl bg-slate-50 mb-2">
                      {allTags.map(tag => {
                        const sel = editTags.includes(tag)
                        return (
                          <button type="button" key={tag} onClick={() => setEditTags(prev => sel ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${sel ? 'bg-[#6B8C6B] text-white border-[#6B8C6B]' : 'bg-white text-slate-600 border-slate-200'}`}>
                            #{tag}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={editCustomTag} onChange={e => setEditCustomTag(e.target.value)} placeholder="Ny tagg..." className="flex-1 p-2 text-xs rounded-xl border border-slate-200 outline-none" />
                      <button type="button" onClick={() => {
                        const t = editCustomTag.trim().replace(/\s+/g, '_')
                        if (!t) return
                        if (!allTags.includes(t)) {
                          setCategories(prev => [...prev, t].sort())
                          fetch(`${API_BASE}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: t }) }).catch(() => {})
                        }
                        if (!editTags.includes(t)) setEditTags(prev => [...prev, t])
                        setEditCustomTag('')
                      }} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold">Lägg till</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-wrap text-slate-700 text-base leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100">{selectedRecipe.fullContent.replace(/!\[.*?\]\(.*?\)\n\n?/, '').replace(/\s*\n\n(#[\wÅÄÖåäö]+ *)+$/, '').trim()}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Skapa/Lägg till Recept Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">Nytt Recept</h2>
              <button type="button" onClick={() => { setShowAddForm(false); setImageFile(null); setImagePreview(null); setImportUrl(''); setImportError(null) }} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
            </div>

            {submitError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{submitError}</div>}

            <div className="p-4 bg-[#f0f5f0] rounded-2xl border border-[#9ab89a] space-y-2">
              <p className="text-xs font-bold text-[#4a6e4a] uppercase tracking-wider">Hämta från recept-sajt</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleImportUrl())}
                  placeholder="Klistra in URL från Köket.se, ICA, Arla..."
                  className="flex-1 p-2.5 text-sm rounded-xl border border-[#9ab89a] bg-white outline-none focus:ring-2 focus:ring-[#6B8C6B]"
                />
                <button type="button" onClick={handleImportUrl} disabled={importLoading || !importUrl.trim()} className="px-4 py-2 bg-[#6B8C6B] text-white rounded-xl text-sm font-semibold hover:bg-[#5a7a5a] disabled:opacity-50 transition-colors whitespace-nowrap">
                  {importLoading ? '...' : 'Hämta'}
                </button>
              </div>
              {importError && <p className="text-xs text-red-600">{importError}</p>}
            </div>

            <form onSubmit={handleAddRecipe} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Receptnamn *</label>
                <input type="text" required maxLength={50} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="t.ex. Krispig Båtlunch-wrap" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6B8C6B] outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Beskrivning & Ingredienser *</label>
                <textarea required rows="5" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Klistra in recept eller skriv instruktioner här..." className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6B8C6B] outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Foto</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Förhandsgranskning" className="w-full h-48 object-cover rounded-2xl" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-[#7d9f7d] hover:bg-[#f0f5f0] transition-all">
                    <div className="flex gap-3 text-slate-400">
                      <Camera size={26} />
                      <ImagePlus size={26} />
                    </div>
                    <span className="text-sm text-slate-500">Ta kort eller välj från galleri</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files[0]
                      if (!file) return
                      setCrop(undefined); setCompletedCrop(null)
                      setCropState({ src: URL.createObjectURL(file), originalName: file.name, onConfirm: (f) => {
                        setImageFile(f)
                        setImagePreview(URL.createObjectURL(f))
                        setCropState(null)
                      }})
                    }} />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Länk till originalinlägg (Källa)</label>
                <input type="url" value={formData.socialUrl} onChange={e => setFormData({...formData, socialUrl: e.target.value})} placeholder="https://instagram.com/p/..." className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6B8C6B] outline-none" />
              </div>

              {/* Välj taggar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Välj kategorier</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border rounded-xl bg-slate-50">
                  {allTags.map(tag => {
                    const isSelected = formData.tags.includes(tag)
                    return (
                      <button type="button" key={tag} onClick={() => handleToggleFormTag(tag)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${isSelected ? 'bg-[#6B8C6B] text-white border-[#6B8C6B]' : 'bg-white text-slate-600 border-slate-200'}`}>
                        #{tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Skapa en helt ny egen kategori */}
              <div className="flex gap-2">
                <input type="text" value={formData.newCustomTag} onChange={e => setFormData({...formData, newCustomTag: e.target.value})} placeholder="Skapa egen tagg..." className="flex-1 p-2 text-xs rounded-xl border border-slate-200 outline-none" />
                <button type="button" onClick={handleAddCustomTag} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold">Lägg till tagg</button>
              </div>

              <button type="submit" disabled={submitting} className="w-full py-3 bg-[#6B8C6B] hover:bg-[#5a7a5a] text-white font-bold rounded-xl transition-all disabled:opacity-50">
                {submitting ? 'Sparar...' : 'Spara Recept'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Nedre Navigeringsmeny för mobil-känsla */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-40">
        <div className="max-w-md mx-auto flex justify-around items-center h-20">
          <button onClick={() => setActiveTab('recipes')} className={`flex flex-col items-center gap-1 ${activeTab === 'recipes' ? 'text-[#6B8C6B]' : 'text-slate-400'}`}>
            <UtensilsCrossed size={24} />
            <span className="text-xs font-medium">Recept</span>
          </button>

          <button onClick={() => setShowAddForm(true)} className="w-14 h-14 bg-[#6B8C6B] rounded-full flex items-center justify-center text-white shadow-md transform -translate-y-4 hover:scale-105 active:scale-95 transition-all">
            <Plus size={28} />
          </button>

          <div className="flex gap-4 items-center">
            <button onClick={() => setActiveTab('categories-grid')} className={`flex flex-col items-center gap-1 ${activeTab === 'categories-grid' ? 'text-[#6B8C6B]' : 'text-slate-400'}`}>
              <Grid3x3 size={22} />
              <span className="text-xs font-medium">Rutnät</span>
            </button>
            <button onClick={() => setActiveTab('categories-list')} className={`flex flex-col items-center gap-1 ${activeTab === 'categories-list' ? 'text-[#6B8C6B]' : 'text-slate-400'}`}>
              <List size={22} />
              <span className="text-xs font-medium">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {cropState && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Beskär bild</h3>
              <button onClick={() => setCropState(null)} className="p-2 bg-slate-100 rounded-full"><X size={18} /></button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100">
              <ReactCrop crop={crop} onChange={(c) => { setCrop(c); setCompletedCrop(c) }}>
                <img ref={imgRef} src={cropState.src} className="max-h-[50vh] max-w-full" alt="Beskär" />
              </ReactCrop>
            </div>
            {completedCrop?.width > 0 && completedCrop?.height > 0
              ? <p className="text-center text-xs text-[#6B8C6B] pb-1">Område valt ✓</p>
              : <p className="text-center text-xs text-slate-400 pb-1">Rita ett område att beskära</p>
            }
            <div className="p-4 pt-1 flex gap-3">
              <button onClick={() => setCropState(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600">Avbryt</button>
              <button
                onClick={async () => {
                  if (!imgRef.current || !completedCrop?.width || !completedCrop?.height) return
                  try {
                    const blob = await getCroppedBlob(imgRef.current, completedCrop)
                    const file = new File([blob], cropState.originalName || 'crop.jpg', { type: 'image/jpeg' })
                    cropState.onConfirm(file)
                  } catch (err) {
                    console.error('Crop error:', err)
                  }
                }}
                disabled={!completedCrop?.width || !completedCrop?.height}
                className="flex-1 py-3 bg-[#6B8C6B] text-white rounded-2xl text-sm font-semibold disabled:opacity-40"
              >Bekräfta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App