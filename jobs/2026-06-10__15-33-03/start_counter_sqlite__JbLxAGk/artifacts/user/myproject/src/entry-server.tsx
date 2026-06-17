import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
  router: createRouter,
  createStream: defaultStreamHandler,
})