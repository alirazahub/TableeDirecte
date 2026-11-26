import app from '../../server/app.js'

export const config = {api:{bodyParser:false}}

export default function handler(req, res) {
  req.url = '/' + req.query.service.map(encodeURIComponent).join('/')
  return app(req, res)
}
