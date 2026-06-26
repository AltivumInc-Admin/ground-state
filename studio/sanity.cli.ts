import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: { projectId: 'pe7zq1it', dataset: 'production' },
  // Hosted Studio at <studioHost>.sanity.studio. Change if the host is taken.
  studioHost: 'groundstate',
  // `deployment.appId` is written automatically on first `sanity deploy`.
  deployment: { autoUpdates: true },
})
