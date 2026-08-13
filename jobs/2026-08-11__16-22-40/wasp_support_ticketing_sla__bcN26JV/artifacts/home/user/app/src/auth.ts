import { defineUserSignupFields } from 'wasp/server/auth'

export const userSignupFields = defineUserSignupFields({
  username: (data: any) => {
    if (!data.username) {
      throw new Error('Username is required')
    }
    return data.username
  },
  password: (data: any) => {
    if (!data.password) {
      throw new Error('Password is required')
    }
    return data.password
  },
  role: (data: any) => {
    const role = data.role || 'CUSTOMER'
    if (!['CUSTOMER', 'AGENT', 'MANAGER'].includes(role)) {
      throw new Error('Invalid role')
    }
    return role
  }
})
