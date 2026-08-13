import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const androidAssetsDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'www');

// Ensure destination directory exists
fs.mkdirSync(androidAssetsDir, { recursive: true });

// Helper to copy directory recursively
function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean old assets
console.log('Cleaning old Android assets...');
fs.rmSync(androidAssetsDir, { recursive: true, force: true });
fs.mkdirSync(androidAssetsDir, { recursive: true });

// Copy new assets
console.log('Copying new assets to Android project...');
if (fs.existsSync(distDir)) {
  copyDir(distDir, androidAssetsDir);
  console.log('Successfully copied assets to ' + androidAssetsDir);
} else {
  console.error('dist directory not found! Run npm run build first.');
  process.exit(1);
}
