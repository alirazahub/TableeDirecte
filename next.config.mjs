export default {
  async rewrites() {
    return [{ source: '/service/:path*', destination: (process.env.API_ORIGIN || 'http://127.0.0.1:4000') + '/:path*' }]
  },
}
