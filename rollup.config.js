import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'static/js/main.js',
  output: {
    file: 'static/js/main.build.js',
    format: 'iife'
  }
  // plugins: [nodeResolve()]
};