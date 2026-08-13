import http from 'node:http'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import serverBuild from './dist/server/server.js'

const port = Number(process.env.PORT) || 8791

const server = http.createServer(async (req, res) => {
  try {
    const webReq = new NodeRequest({ req, res })
    const webRes = await serverBuild.fetch(webReq)
    await sendNodeResponse(res, webRes)
  } catch (err) {
    console.error('Server Error:', err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
})

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
