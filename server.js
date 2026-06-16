import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import multer from 'multer';

const app = express();
const port = 3001;

// Tillåt alla nätverksenheter (mobil + dator)
app.use(cors({ origin: '*' }));
app.use(express.json());

const recipesPath = path.join(process.cwd(), '..', '..', '01_ Knowledge_base', '02_Personal', 'Recipes');
const imagesPath = path.join(process.cwd(), '..', '..', '01_ Knowledge_base', '02_Personal', 'RecipeImages');
const hiddenTagsPath = path.join(process.cwd(), '..', '..', '01_ Knowledge_base', '02_Personal', 'hidden_tags.json');

// Skapa mapparna om de inte finns
if (!fs.existsSync(recipesPath)) fs.mkdirSync(recipesPath, { recursive: true });
if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath, { recursive: true });

function getHiddenTags() {
    if (!fs.existsSync(hiddenTagsPath)) return [];
    try { return JSON.parse(fs.readFileSync(hiddenTagsPath, 'utf-8')); } catch { return []; }
}

// Bilduppladdning med multer
const storage = multer.diskStorage({
    destination: imagesPath,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

app.use('/images', express.static(imagesPath));

// 1. Hämta alla recept
app.get('/api/recipes', (req, res) => {
    try {
        const files = fs.readdirSync(recipesPath);
        const recipes = files.filter(f => f.endsWith('.md')).map(f => ({
            id: f,
            title: f.replace('.md', ''),
            content: fs.readFileSync(path.join(recipesPath, f), 'utf-8')
        }));
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read recipes' });
    }
});

// 2. Spara ett recept (Fixad för att hantera både content och recipeContent)
app.post('/api/recipes', (req, res) => {
    try {
        const { title, content, recipeContent } = req.body;
        const finalContent = content || recipeContent; // Tar det som skickas

        if (!title) return res.status(400).json({ error: 'Title is required' });
        if (!finalContent) return res.status(400).json({ error: 'Content is required' });

        const fileName = `${title.replace(/[^a-z0-9åäöÅÄÖ]/gi, '_')}.md`;
        fs.writeFileSync(path.join(recipesPath, fileName), finalContent);
        
        console.log(`Saved recipe: ${fileName}`);
        res.status(201).json({ message: 'Saved successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save recipe' });
    }
});

// 3. Spara kategori / taggar (Om frontend skickar separata kategorier)
app.post('/api/categories', (req, res) => {
    try {
        const { category } = req.body;
        console.log(`Category received: ${category}`);
        // Här kan du välja att spara kategorier i en separat fil om det behövs, 
        // just nu svarar vi bara OK så att frontenden inte hänger sig.
        res.status(201).json({ message: 'Category updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save category' });
    }
});

// 4. Ladda upp bild
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Ingen fil mottagen' });
    res.json({ url: `../RecipeImages/${req.file.filename}` });
});

// 5. Uppdatera ett recept
app.put('/api/recipes/:id', (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });
        const oldFileName = req.params.id;
        const newFileName = `${title.replace(/[^a-z0-9åäöÅÄÖ]/gi, '_')}.md`;
        const oldPath = path.join(recipesPath, oldFileName);
        if (oldFileName !== newFileName && fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
        fs.writeFileSync(path.join(recipesPath, newFileName), content);
        console.log(`Updated: ${newFileName}`);
        res.json({ message: 'Updated', id: newFileName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update recipe' });
    }
});

// 6. Hämta dolda kategorier
app.get('/api/hidden-tags', (req, res) => {
    res.json(getHiddenTags());
});

// 6. Dölj en kategori
app.delete('/api/categories/:name', (req, res) => {
    const name = decodeURIComponent(req.params.name);

    // Add to hidden list
    const hidden = getHiddenTags();
    if (!hidden.includes(name)) {
        hidden.push(name);
        fs.writeFileSync(hiddenTagsPath, JSON.stringify(hidden));
    }

    // Strip #Tag from all recipe files
    const tagRegex = new RegExp(`\\s*#${name}(?=\\s|$)`, 'g');
    const files = fs.readdirSync(recipesPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
        const filePath = path.join(recipesPath, file);
        const original = fs.readFileSync(filePath, 'utf-8');
        const updated = original.replace(tagRegex, '').replace(/\n\n\n+/g, '\n\n').trimEnd();
        if (updated !== original) fs.writeFileSync(filePath, updated);
    }

    res.json({ message: 'Hidden' });
});

// 7. Radera ett recept
app.delete('/api/recipes/:id', (req, res) => {
    try {
        const fileName = req.params.id;
        if (!fileName.endsWith('.md')) return res.status(400).json({ error: 'Invalid file' });
        const filePath = path.join(recipesPath, fileName);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Recipe not found' });
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${fileName}`);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete recipe' });
    }
});

app.listen(port, () => {
    console.log(`---`);
    console.log(`Server is LIVE at http://localhost:${port}`);
    console.log(`Reading recipes from: ${recipesPath}`);
    console.log(`---`);
});