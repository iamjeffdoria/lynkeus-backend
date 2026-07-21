import app from './app.js'
import os from 'os'

function getLanIP() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

const PORT = Number(process.env.PORT) || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lynkeus backend running on:`)
  console.log(`  Local:   http://localhost:${PORT}`)
  console.log(`  Network: http://${getLanIP()}:${PORT}`)
})