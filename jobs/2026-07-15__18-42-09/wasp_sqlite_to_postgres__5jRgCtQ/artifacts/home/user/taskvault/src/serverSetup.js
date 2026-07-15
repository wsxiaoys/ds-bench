import { recordStartupEvent } from 'wasp/server/jobs'

export const serverSetup = async () => {
  console.log('Server setup: submitting recordStartupEvent job...')
  await recordStartupEvent.submit({ message: 'Server started - job ran on boot' })
  console.log('Server setup: recordStartupEvent submitted.')
}
