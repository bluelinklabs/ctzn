import {css} from '../../vendor/lit-element/lit-element.js'

const cssStr = css`
header {
  display: flex;
  justify-content: space-between;
  background: var(--bg-color--secondary);
  color: var(--text-color--default);
  padding: 10px 10px;
  font-size: 15px;
  line-height: 1;
  border-bottom: 1px solid var(--border-color--light);
  margin-bottom: 24px;
}

header a {
  color: inherit;
}

header a:hover {
  cursor: pointer;
  text-decoration: underline;
}

header .brand {
  font-weight: bold;
}

header ctzn-header-session a {
  padding: 0 5px;
}
`
export default cssStr