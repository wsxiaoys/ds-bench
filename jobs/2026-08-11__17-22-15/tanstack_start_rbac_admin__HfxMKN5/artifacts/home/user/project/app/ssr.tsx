/// <reference types="vinxi/client" />
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
  createRouter,
  getHeaders: () => {
    return {
      headers: {
        'x-powered-by': 'TanStack Start',
      },
    }
  },
})(defaultStreamHandler)
