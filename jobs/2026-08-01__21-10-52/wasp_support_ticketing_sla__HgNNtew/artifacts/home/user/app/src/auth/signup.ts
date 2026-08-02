import { defineUserSignupFields } from 'wasp/server/auth'

export const userSignupFields = defineUserSignupFields({
  username: (data) => {
    const val = data.username
    if (typeof val !== 'string') {
      throw new Error('Username is required')
    }
    return val
  },
  password: (data) => {
    const val = data.password
    if (typeof val !== 'string') {
      return 'password123'
    }
    return val
  },
  role: (data) => {
    const val = data.role
    if (typeof val !== 'string') {
      return 'CUSTOMER'
    }
    return val
  }
})
