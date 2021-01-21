import {css} from '../../vendor/lit-element/lit-element.js'
import buttonsCSS from './buttons.css.js'

const cssStr = css`
${buttonsCSS}

:host {
  display: block;
  border-bottom: 1px solid var(--border-color--very-light);
  margin-bottom: 24px;
}

header {
  display: flex;
  max-width: 860px;
  margin: 0 auto;
  align-items: center;
  color: var(--text-color--default);
  padding: 0 10px;
  font-size: 15px;
  line-height: 1;
}

a {
  display: inline-block;
  color: inherit;
  text-decoration: none;
  padding: 14px 14px 12px;
  border-bottom: 2px solid transparent;
}

a:hover {
  cursor: pointer;
  background: var(--bg-color--dark);
}

a.current {
  border-bottom: 2px solid var(--blue);
}

a .navicon {
  margin-right: 5px;
}

.spacer {
  flex: 1;
}

button {
  margin-right: 5px;
  border-radius: 16px;
  padding: 7px 20px;
}

a.profile {
  display: inline-flex;
  align-items: center;
  padding: 12px 14px 10px;
}

a.profile img {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 5px;
}
`
export default cssStr