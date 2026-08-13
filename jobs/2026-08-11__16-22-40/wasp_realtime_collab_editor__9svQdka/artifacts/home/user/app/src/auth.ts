import { defineUserSignupFields } from 'wasp/server/auth'

export const userSignupFields = defineUserSignupFields({
  username: (data: any) => {
    if (!data || !data.username) {
      throw new Error('Username is required')
    }
    if (typeof data.username !== 'string') {
      throw new Error('Username must be a string')
    }
    return data.username
  },
})
