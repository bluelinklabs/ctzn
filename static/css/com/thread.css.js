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

.subject {
  background: var(--bg-color--default);
  border: 1px solid var(--border-color--light);
  border-radius: 4px;
  padding: 0 10px;
}

.comments-header {
  background: var(--bg-color--light);
  padding: 10px;
  margin-bottom: 2px;
  font-size: 13px;
  color: var(--text-color--light);
}

.comments-header strong {
  color: var(--text-color--default);
}

.comments-header > div:first-child {
  margin: 0 4px 10px;
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

.comment-prompt + .replies {
  margin-top: 10px;
}

.replies .replies {
  margin: 0 0 0 19px;
  padding-left: 10px;
  border-left: 1px solid var(--border-color--semi-light);
}

.replies ctzn-post {
  display: block;
  margin-bottom: 10px;
}

.replies ctzn-post.highlight {
  background: var(--bg-color--unread);
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