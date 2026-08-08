// Scans ../skills/**/SKILL.md and writes src/data/skills.json so the site
// always reflects the actual skills in the repo. Runs automatically before
// dev and build (predev/prebuild).
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(__dirname, '..', '..', 'skills');
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'skills.json');

const EXCLUDED_CATEGORIES = new Set(['deprecated']);

function parseFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1 || /^\s/.test(line)) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) data[key] = value;
  }
  return data;
}

const skills = [];

for (const category of readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
  if (!category.isDirectory() || EXCLUDED_CATEGORIES.has(category.name)) continue;

  const categoryPath = join(SKILLS_ROOT, category.name);
  for (const entry of readdirSync(categoryPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    let md;
    try {
      md = readFileSync(join(categoryPath, entry.name, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }

    const fm = parseFrontmatter(md);
    skills.push({
      name: fm.name || entry.name,
      description: fm.description || '',
      category: category.name,
      install: `npx skills@latest add creativoma/skills/${entry.name}`,
    });
  }
}

skills.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(skills, null, 2) + '\n');
console.log(`Generated ${skills.length} skills → src/data/skills.json`);
