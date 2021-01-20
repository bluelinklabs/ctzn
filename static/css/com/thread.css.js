import {css} from '../../vendor/lit-element/lit-element.js'
import buttonsCSS from './buttons.css.js'
import inputsCSS from './inputs.css.js'
import tooltipCSS from './tooltip.css.js'
import spinnerCSS from './spinner.css.js'

const cssStr = css`
${buttonsCSS}
${inputsCSS}
${tooltipCSS}
${spinnerCSS}

:host {
  display: block;
  position: relative;
  background: var(--bg-color--default);
}

:host([full-page]) {
  background: transparent;
}

ctzn-record {
  display: block;
}

.loading {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.loading .spinner {
  margin-right: 10px;
}

.comments-loading {
  padding: 0 10px;
}

.item {
  background: var(--bg-color--default);
  border: 1px solid var(--border-color--light);
  border-radius: 4px;
  padding: 0 10px;
  margin: 0 0 10px;
}

.item.highlight {
  background: var(--bg-color--highlight);
  border-color: var(--border-color--highlight);
}

.comment-box {
  margin: 2px 0px 10px 48px;
}

.comment-prompt {
  cursor: text;
  padding: 10px 14px;
  border-radius: 4px;
  border: 1px solid var(--border-color--light);
  font-style: italic;
  background: var(--bg-color--default);
  color: var(--text-color--light);
}

.replies {
  margin: 0 0 0 10px;
  padding-left: 10px;
  border-left: 1px solid var(--border-color--semi-light);
}

.error {
  border: 1px solid var(--border-color--light);
  padding: 12px 16px;
  border-radius: 4px;
  margin: 0 -15px;
  color: var(--text-color--light);
}

.error h2 {
  margin-top: 0;
  color: var(--text-color--default);
}

`
export default cssStr