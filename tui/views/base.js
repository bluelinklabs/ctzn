import blessed from 'blessed'

export class BaseView {
  constructor (screen, globals) {
    this.screen = screen
    this.globals = globals
    this.resetScreen()
    this.setup()
  }

  resetScreen () {
    let children = this.screen.children.slice()
    for (let node of children) {
      this.screen.remove(node)
    }
    this.screen.render()
    this._addCommon()
  }

  _addCommon () {
    let content = `CTZN ${this.globals.pkg.version} `
    const items = ['Home', 'Hyperspace']
    for (let i = 0; i < items.length; i++) {
      let highlight = this.constructor.name === `${items[i]}View` ? '{inverse}' : ''
      content += `${highlight} {bold}F${i+1}{/}${highlight} ${items[i]} {/}`
    }

    var header = blessed.text({
      top: '0',
      left: '0',
      width: '100%',
      height: '1',
      content,
      tags: true,
      style: {
        fg: 'black',
        bg: 'green'
      }
    })
    this.screen.append(header)
  }

  setup () {
    // override me
  }

  teardown () {
    // override me
  }

  async ask (question) {
    let width = Math.max(question.length, 18) + 4
    const prompt = blessed.question({
      top: 'center',
      left: 'center',
      width: '0%+' + width,
      height: '0%+4',
      border: {
        type: 'line',
        fg: 'green'
      },
      tags: true,
      style: {
        fg: 'green',
        bg: 'black'
      }
    })
    prompt._.okay.style.fg = 'green'
    prompt._.cancel.style.fg = 'green'
    this.screen.append(prompt)
    this.screen.saveFocus()
    return new Promise((resolve, reject) => {
      prompt.ask(question, (err, res) => {
        prompt.detach()
        this.screen.restoreFocus()
        this.screen.render()
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}