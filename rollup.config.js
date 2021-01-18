export default [
  {
    input: 'static/js/main.js',
    output: {
      file: 'static/js/main.build.js',
      format: 'iife'
    }
  },
  {
    input: 'static/js/login.js',
    output: {
      file: 'static/js/login.build.js',
      format: 'iife'
    }
  },
  {
    input: 'static/js/signup.js',
    output: {
      file: 'static/js/signup.build.js',
      format: 'iife'
    }
  }
]