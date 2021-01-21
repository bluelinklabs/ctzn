import {css} from '../vendor/lit-element/lit-element.js'
import buttonsCSS from './com/buttons.css.js'
import tooltipCSS from './com/tooltip.css.js'
import inputsCSS from './com/inputs.css.js'
import spinnerCSS from './com/spinner.css.js'

const cssStr = css`
${buttonsCSS}
${tooltipCSS}
${inputsCSS}
${spinnerCSS}

:host {
  display: block;
}

.hidden {
  display: none !important;
}

a {
  text-decoration: none;
  color: inherit;
}

a:hover {
  text-decoration: underline;
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