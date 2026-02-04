/**
 * Hostinger entry point. Builds frontend if needed, then starts Express.
 */
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')

if (!existsSync(join(distPath, 'index.html'))) {
  console.log('Building frontend...')
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname })
}

await import('./server/index.js')
