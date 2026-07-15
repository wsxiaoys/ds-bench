import { logStartupEvent } from 'wasp/server/jobs'

export const serverSetup = async () => {
  await logStartupEvent.submit({})
}
