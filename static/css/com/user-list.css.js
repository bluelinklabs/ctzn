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
}

a {
  text-decoration: none;
  color: inherit;
}

a:hover {
  text-decoration: underline;
}

.profiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 10px;
}

.profile {
  border: 1px solid var(--border-color--light);
  background: var(--bg-color--default);
  border-radius: 4px;
  padding: 10px;
}

.header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.avatar img {
  display: block;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  box-shadow: rgba(0, 0, 0, 0.333) 0px 1px 2px;
}

.display-name {
  color: var(--text-color--default);
  font-size: 19px;
}

.username {
  color: var(--text-color--light);
  font-weight: 500;
}

.description {
  margin: 10px 0;
}

.stat {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color--pretty-light);
  cursor: pointer;
}

.stat .stat-number {
  font-size: 17px;
}

.label {
  display: inline-block;
  color: var(--text-color--light);
  background: var(--bg-color--dark);
  font-weight: bold;
  font-size: 11px;
  margin-left: 10px;
  padding: 2px 5px;
  border-radius: 2px;
}
`
export default cssStr