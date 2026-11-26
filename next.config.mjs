export default {
  async rewrites() {
    const origin = process.env.API_ORIGIN?.replace(/\/$/, '')
    return {
      beforeFiles:origin ? [{source:'/api/live',destination:origin + '/api/live'}] : [],
      afterFiles:[{source:'/service/:path*', destination:origin ? origin + '/:path*' : '/api/:path*'}],
    }
  },
  async headers() {
    return [{source:'/:path*', headers:[{key:'Referrer-Policy',value:'no-referrer'}]}]
  },
}
