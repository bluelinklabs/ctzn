import {css} from '../vendor/lit-element/lit-element.js'
import commonCSS from './common.css.js'
import buttonsCSS from './buttons2.css.js'
import tooltipCSS from './tooltip.css.js'
import inputsCSS from './inputs.css.js'
import spinnerCSS from './com/spinner.css.js'
import headerCSS from './com/header.css.js'

const cssStr = css`
${commonCSS}
${buttonsCSS}
${tooltipCSS}
${inputsCSS}
${spinnerCSS}
${headerCSS}

:host {
  display: block;
}

.hidden {
  display: none !important;
}

.login-form {
  margin: 100px auto;
  max-width: 400px;
  background: var(--bg-color--secondary);
  border: 1px solid var(--border-color--light);
  padding: 20px;
}

.login-form h2,
.login-form .form-control {
  margin: 0 0 15px;
}

.login-form .form-control > * {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 4px;
}

.login-form .form-control input {
  padding: 8px;
  font-size: 15px;
}

.login-form .error {
  background: var(--bg-color--error);
  padding: 10px;
  color: var(--text-color--error);
}

.login-form .submit-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-color--light);
  margin-top: 25px;
  padding-top: 15px;
}

`
export default cssStr