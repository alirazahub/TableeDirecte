import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import app from './app.js'
import { attachSocket } from './realtime.js'

const server = createServer(app)
const sockets = new WebSocketServer({server,path:'/api/live',maxPayload:4096})
sockets.on('connection',(socket,request) => {
  const origin = request.headers.origin
  const hosts = [request.headers.host,request.headers['x-forwarded-host'],process.env.PUBLIC_URL && new URL(process.env.PUBLIC_URL).host]
  if (origin && !hosts.some(host => host && (origin === 'https://' + host || origin === 'http://' + host))) return socket.close(1008,'Invalid origin')
  socket.on('error',() => socket.close())
  attachSocket(socket,request.headers.cookie)
})
server.on('error',error => {console.error(error);process.exitCode=1})
server.listen(Number(process.env.API_PORT || 4000),process.env.API_HOST || '127.0.0.1',() => console.log('Tablée Directe API and WebSockets ready'))
