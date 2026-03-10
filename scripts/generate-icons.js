// Generate PWA icons as SVG-based PNGs
// Run: node scripts/generate-icons.js

const fs = require('fs')
const path = require('path')

function createSvgIcon(size) {
  const fontSize = Math.round(size * 0.35)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#1e40af"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">DA</text>
</svg>`
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

// Write SVG files that will work as icons
// For proper PNG, we'd need sharp/canvas, but SVGs work for development
// In production, convert these to PNG using any image tool

const sizes = [192, 512]
sizes.forEach(size => {
  const svg = createSvgIcon(size)
  // Save as SVG (browsers accept SVG for PWA icons in many cases)
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.svg`), svg)
  console.log(`Created icon-${size}.svg`)
})

console.log('\nNote: For production, convert SVGs to PNGs using:')
console.log('  npx sharp-cli icon-192.svg -o icon-192.png')
console.log('  npx sharp-cli icon-512.svg -o icon-512.png')
console.log('Or use any online SVG-to-PNG converter.')
