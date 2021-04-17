#!/usr/bin/env node

import subcommand from 'subcommand'
import * as db from './db/index.js'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as tui from './tui/index.js'

const PACKAGE_JSON_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'package.json')

import { start } from './index.js'

const match = subcommand({
  commands: [
    {
      name: 'start',
      command: args => {
        start({
          port: args.port,
          domain: args.domain,
          configDir: args.configDir,
          hyperspaceHost: args.hyperspaceHost,
          hyperspaceStorage: args.hyperspaceStorage,
          extensions: args.extensions || ''
        })
      }
    },
    {
      name: 'start-test',
      command: args => {
        if (!args.configDir) throw new Error('--configDir required')
        if (!args.domain) throw new Error('--domain required')
        start({
          debugMode: true,
          simulateHyperspace: true,
          port: args.port,
          configDir: args.configDir,
          domain: args.domain,
          extensions: args.extensions || ''
        })
      }
    },
    {
      name: 'create-user',
      command: async args => {
        // TODO- this needs to work without starting the server
        await start({
          debugMode: true,
          port: 3000,
          domain: args.domain,
          configDir: args.configDir,
          hyperspaceHost: args.hyperspaceHost,
          hyperspaceStorage: args.hyperspaceStorage
        })
        await db.createUser({
          type: 'citizen',
          username: args.username,
          email: args.email,
          password: args.password,
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
        await start({
          debugMode: true,
          port: 3000,
          domain: args.domain,
          configDir: args.configDir,
          hyperspaceHost: args.hyperspaceHost,
          hyperspaceStorage: args.hyperspaceStorage
        })
        for (let username of ['alice', 'bob', 'carla', 'dan', 'erica', 'finn']) {
          await db.createUser({
            type: 'citizen',
            username: username,
            email: `${username}@email.com`,
            password: 'password',
            profile: {
              displayName: username.slice(0, 1).toUpperCase() + username.slice(1)
            }
          })
          console.log(username, 'created')
        }
        process.exit(0)
      }
    },
    {
      name: 'create-community',
      command: async args => {
        // TODO- this needs to work without starting the server
        await start({
          debugMode: true,
          port: 3000,
          domain: args.domain,
          configDir: args.configDir,
          hyperspaceHost: args.hyperspaceHost,
          hyperspaceStorage: args.hyperspaceStorage
        })
        await db.createUser({
          type: 'community',
          username: args.username,
          profile: {
            displayName: args.displayName,
            description: args.description
          }
        })
        console.log(args.username, 'created')
        process.exit(0)
      }
    }
  ],
  root: {
    command: (args) => {
      const packageJson = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')
      const pkg = JSON.parse(packageJson)
      if (args.v || args.version) {
        console.log('CTZN', pkg.version)
      } else {
        tui.start({pkg})
      }
    }
  }
})
const cmd = match(process.argv.slice(2))
