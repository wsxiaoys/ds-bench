import cors from 'cors'
import express from 'express'
import { config, type MiddlewareConfigFn } from 'wasp/server'

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // 1. Extends allowed CORS origins
  middlewareConfig.set('cors', cors({ origin: [...config.allowedCORSOrigins, 'http://localhost:5000'] }))
  
  // 2. Adds custom middleware entry setting X-Global: enabled
  middlewareConfig.set('x-global', (req, res, next) => {
    res.set('X-Global', 'enabled')
    next()
  })
  
  return middlewareConfig
}

export const apiNamespaceMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Delete body parsers at the namespace level to avoid pre-parsing the body
  middlewareConfig.delete('express.json')
  middlewareConfig.delete('express.urlencoded')
  
  middlewareConfig.set('x-api-namespace', (req, res, next) => {
    res.set('X-Api-Namespace', 'v1')
    next()
  })
  return middlewareConfig
}

export const echoMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Replace the default JSON body parser with a raw body parser
  middlewareConfig.set('express.json', express.raw({ type: '*/*' }))
  
  // Set the response header X-Echo: raw
  middlewareConfig.set('x-echo', (req, res, next) => {
    res.set('X-Echo', 'raw')
    next()
  })
  
  return middlewareConfig
}
