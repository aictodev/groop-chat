import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..', '..')
const source = path.join(root, 'groop-chat.jpeg')
const targetPng = path.join(root, 'frontend', 'public', 'groop-chat.png')
const targetIco = path.join(root, 'frontend', 'public', 'groop-chat.ico')

async function main() {
  await sharp(source)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(targetPng)

  await sharp(targetPng)
    .resize(256, 256)
    .toFile(targetIco)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
