module.exports = {
  purge: {
    content: [
      './static/**/*.html',
      './static/**/*.js'
    ],
    options: {
      safelist: [
        'bg-red-50',
        'bg-pink-600',
        'hover:bg-pink-700',
        'border-pink-800',
        'text-green-900',
        'text-blue-900',
        'text-red-900',
        'bg-green-400',
        'bg-blue-400',
        'bg-red-400'
      ]
    }
  },
  darkMode: 'media',
  theme: {
    extend: {
      gridTemplateColumns: {
        'layout-twocol': 'minmax(0, 1fr) 260px',
        post: '50px 1fr',
        'post-tight': '30px 65px 1fr',
        composer: '42px 1fr',
      },
      screens: {
        hov: {raw: '(hover: hover)'},
      }
    }
  },
  variants: {
    extend: {
      margin: ['last']
    }
  },
  plugins: [],
}