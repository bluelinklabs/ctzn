import {css, unsafeCSS} from '../../vendor/lit-element/lit-element.js'
import buttonsCSS from './buttons.css.js'
import inputsCSS from './inputs.css.js'
import tooltipCSS from './tooltip.css.js'

const cssStr = css`
${buttonsCSS}
${inputsCSS}
${tooltipCSS}

:host {
  display: block;
  border-top: 1px solid var(--border-color--very-light);
}

.wrapper:hover {
  cursor: pointer;
  background: var(--bg-color--light);
}

.wrapper.unread {
  background: var(--bg-color--unread);
  border-top: 1px solid var(--border-color--unread);
}

.wrapper.unread:hover {
  background: var(--bg-color--unread-hover);
}

a {
  text-decoration: none;
  cursor: initial;
}

a:hover {
  text-decoration: underline;
  cursor: pointer;
}

.notification {
  display: flex;
  align-items: center;
  padding: 14px 10px 4px;
}

.notification.padded {
  padding: 16px 10px 16px;
}

.notification > * {
  margin-right: 5px;
}

.notification .far,
.notification .fas {
  font-size: 21px;
  margin-right: 20px;
  margin-left: 8px;
  color: var(--text-color--pretty-light);
}

.notification a.author {
  display: inline-flex;
  align-items: center;
  color: var(--text-color--default);
  font-weight: bold;
}

.notification a.author img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  margin-right: 10px;
}

.subject {
  margin-left: 44px;
  margin-top: 3px;
  padding-bottom: 16px;
}

.subject ctzn-post {
  --text-color--post-content: var(--text-color--light);
}

.comment {
  padding: 2px 10px;
}

.user-card {
  padding: 0 0 14px 54px;
}
`
export default cssStr