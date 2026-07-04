import { defineCliConfig } from 'sanity/cli'
import { projectId, dataset } from './env'

export default defineCliConfig({
  api: { projectId, dataset },
  // Hosted Studio at groundstate.sanity.studio.
  studioHost: 'groundstate',
  deployment: { appId: 'udet8i7qzk953pfo1ygcv7ct', autoUpdates: true },
})
