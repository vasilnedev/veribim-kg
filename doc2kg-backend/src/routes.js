import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const upload = multer()
const baseRoute = '/doc2kg-backend'

// Helper function to recursively find all JS files in a directory
async function getJsFiles (dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name)
    return dirent.isDirectory() ? getJsFiles(res) : res
  }))
  return Array.prototype.concat(...files).filter(file => file.endsWith('.js'))
}

export const setupRoutes = async (app) => {
  const apiDocs = []
  const requestHandlersDir = path.join(__dirname, 'requestHandlers')
  const handlerFiles = await getJsFiles(requestHandlersDir)

  for (const file of handlerFiles) {
    try {
      const module = await import(pathToFileURL(file).href)

      if (module.documentation) {
        const { method, path: routePath, body } = module.documentation

        // Find the exported function that serves as the handler
        const handler = Object.values(module).find(exp => typeof exp === 'function')

        if (handler && method && routePath) {
          const fullPath = (baseRoute + routePath).replace(/\/+/g, '/')
          const routeHandlers = []

          // Add multer middleware for POST requests indicating multipart/form-data and "pdf file"
          if (method.toUpperCase() === 'POST' && typeof body === 'string' && body.toLowerCase().includes('pdf file')) {
            routeHandlers.push(upload.single('pdf'))
          }
          routeHandlers.push(handler)

          app[method.toLowerCase()](fullPath, ...routeHandlers)
          console.log(`Method: ${method} Path:${fullPath} - added.`)

          // Add to documentation list
          apiDocs.push({ ...module.documentation, path: fullPath })
        }
      }
    } catch (e) {
      console.error(`Error loading route from ${file}:`, e)
    }
  }

  // Base route to serve the collected API documentation
  app.get(baseRoute, (req, res) => {
    apiDocs.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
    res.status(200).json(apiDocs)
  })
}