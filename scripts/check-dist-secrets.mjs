import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

const uuidLike = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const forbiddenSubstrings = ['api_key', 'Bearer '];

function listFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...listFilesRecursive(full));
    else files.push(full);
  }
  return files;
}

if (!fs.existsSync(distDir)) {
  console.log('dist 不存在，跳过扫描');
  process.exit(0);
}

const files = listFilesRecursive(distDir).filter(f => f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.css'));
const hits = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const s of forbiddenSubstrings) {
    if (text.includes(s)) hits.push({ file, reason: `包含敏感片段: ${s}` });
  }
  const uuids = text.match(uuidLike);
  if (uuids && uuids.length > 0) hits.push({ file, reason: `包含疑似 UUID 密钥片段: ${uuids[0]}` });
}

if (hits.length > 0) {
  console.error('dist 扫描发现疑似敏感信息：');
  for (const h of hits.slice(0, 50)) {
    console.error(`- ${path.relative(projectRoot, h.file)}: ${h.reason}`);
  }
  process.exit(1);
}

console.log('dist 扫描通过：未发现疑似敏感信息');

