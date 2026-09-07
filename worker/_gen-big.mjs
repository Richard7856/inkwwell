import { loadImage, createCanvas } from 'canvas'
import { writeFileSync } from 'fs'
const SP = process.argv[2]
const src = await loadImage(`${SP}/A-textura-rica.png`)
// Simular foto de celular típica: 12MP (4000x3000)
for (const [w, h, name] of [[4000, 3000, 'foto-celular-12MP'], [1500, 1125, 'foto-reducida-1500']]) {
  const c = createCanvas(w, h)
  c.getContext('2d').drawImage(src, 0, 0, w, h)
  const buf = c.toBuffer('image/jpeg', { quality: 0.9 })
  writeFileSync(`${SP}/${name}.jpg`, buf)
  console.log(name, `${w}x${h}`, (buf.length/1024/1024).toFixed(2)+'MB')
}
