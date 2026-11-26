import app from './app.js'

app.listen(Number(process.env.API_PORT || 4000), '127.0.0.1', error => {
  if (error) {
    console.error(error)
    process.exit(1)
  }
  console.log('Tablée Directe API ready')
})
