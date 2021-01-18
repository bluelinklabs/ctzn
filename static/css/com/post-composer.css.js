import {css} from '../../vendor/lit-element/lit-element.js'
import buttonsCSS from './buttons.css.js'
import inputsCSS from './inputs.css.js'
import tooltipCSS from './tooltip.css.js'

const cssStr = css`
${buttonsCSS}
${inputsCSS}
${tooltipCSS}

.editor {
  margin-bottom: 6px;
}

textarea {
  font-family: var(--system-font);
  font-size: 15px;
  margin: 0;
  padding: 12px 16px;
  width: 100%;
  box-sizing: border-box;
  resize: none;
}

.char-limit {
  padding: 0 5px;
  color: var(--text-color--light);
}

.char-limit.close {
  font-weight: bold;
  color: var(--text-color--warning);
}

.char-limit.over {
  font-weight: bold;
  color: var(--text-color--error);
}

.actions {
  display: flex;
  justify-content: space-between;
}

button {
  font-size: 15px;
}
`
export default cssStr
