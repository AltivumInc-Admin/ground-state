import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: { projectId: 'pe7zq1it', dataset: 'production' },
  // Hosted Studio at groundstate.sanity.studio.
  studioHost: 'groundstate',
  deployment: { appId: 'udet8i7qzk953pfo1ygcv7ct', autoUpdates: true },
})
