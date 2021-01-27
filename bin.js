import subcommand from 'subcommand'
import path from 'path'
import os from 'os'
import * as db from './db/index.js'

import { start } from './index.js'

const match = subcommand({
  commands: [
    {
      name: 'start',
      command: args => {
        start({debugMode: true, port: 3000})
      }
    },
    {
      name: 'start-test',
      command: args => {
        if (!args.port) throw new Error('--port required')
        if (!args.configDir) throw new Error('--configDir required')
        if (!args.domain) throw new Error('--domain required')
        start({
          debugMode: true,
          simulateHyperspace: true,
          port: args.port,
          configDir: args.configDir,
          domain: args.domain
        })
      }
    },
    {
      name: 'create-user',
      command: async args => {
        // TODO- this needs to work without starting the server
        await start({debugMode: true, port: 3000})
        await db.createUser({
          username: args.username,
          email: args.email,
          profile: {
            displayName: args.displayName,
            description: args.description
          }
        })
        console.log(args.username, 'created')
        process.exit(0)
      }
    },
    {
      name: 'create-test-users',
      command: async args => {
        // TODO- this needs to work without starting the server
        await start({debugMode: true, port: 3000})
        for (let username of ['alice', 'bob', 'carla', 'dan', 'erica', 'finn']) {
          await db.createUser({
            username: username,
            email: `${username}@email.com`,
            profile: {
              displayName: username.slice(0, 1).toUpperCase() + username.slice(1)
            }
          })
          console.log(username, 'created')
        }
        process.exit(0)
      }
    }
  ],
  root: {
    command: args => {
      start({debugMode: true, port: 3000})
    }
  }
})
const cmd = match(process.argv.slice(2))