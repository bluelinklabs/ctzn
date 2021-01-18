import {css} from '../vendor/lit-element/lit-element.js'
import commonCSS from './common.css.js'
import buttonsCSS from './buttons2.css.js'
import tooltipCSS from './tooltip.css.js'
import spinnerCSS from './com/spinner.css.js'
import headerCSS from './com/header.css.js'

const cssStr = css`
${commonCSS}
${buttonsCSS}
${tooltipCSS}
${spinnerCSS}
${headerCSS}

:host {
  display: block;
}

.hidden {
  display: none !important;
}

h2 {
  margin: 0px 45px 0px;
  letter-spacing: 1px;
  font-size: 24px;
}

h2 a {
  color: #5085ff;
  font-size: 17px;
}

.composer {
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 15px;
  font-size: 14px;
}

.composer .thumb {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  margin-top: 4px;
}

.compose-post-prompt {
  border: 1px solid var(--border-color--light);
  padding: 12px 16px;
  border-radius: 4px;
  color: var(--text-color--light);
  cursor: text;
}

.search-ctrl {
  display: flex;
  position: relative;
  height: 32px;
  margin: 0 0 15px;
  z-index: 5;
}

.search-ctrl .fa-search,
.search-ctrl .spinner {
  position: absolute;
  z-index: 2;
  font-size: 13px;
  top: 10px;
  left: 14px;
  color: #99a;
}

.search-ctrl .spinner {
  top: 9px;
}

.search-ctrl input {
  position: relative;
  top: -1px;
  background: var(--bg-color--semi-light);
  color: inherit;
  box-sizing: border-box;
  height: 34px;
  flex: 1;
  font-size: 12px;
  letter-spacing: 0.5px;
  font-weight: 500;
  padding: 0 0 0 36px;
  border: 0 solid var(--border-color--default);
  border-radius: 24px;
}

.search-ctrl input:focus {
  background: var(--bg-color--default);
  border-color: var(--border-color--focused);
  box-shadow: 0 0 2px #7599ff77;
}

.search-ctrl .clear-search {
  position: absolute;
  left: 10px;
  top: 6px;
  z-index: 2;
  display: flex;
  background: var(--bg-color--semi-light);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
}

.search-ctrl .clear-search span {
  margin: auto;
}

main {
}

.twocol {
  margin: 10px auto 20px;
  max-width: 840px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
  gap: 30px;
}

.twocol .sticky {
  position: sticky;
  top: 10px;
}

.twocol .sidebar > div {
  padding-top: 4px;
}

.twocol .sidebar h3 {
  box-sizing: border-box;
  letter-spacing: 1px;
  margin: 3px 0;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--text-color--pretty-light);
}

.twocol .sidebar section {
  margin-bottom: 20px;
}

@media (max-width: 900px) {
  .twocol {
    display: block;
  }
  .two .sidebar section {
    margin-bottom: 0;
  }
  .two > :last-child {
    display: none;
  }
  ctzn-sites-list {
    margin-top: 20px;
  }
}

.nav a {
  display: block;
  font-size: 16px;
  padding: 5px;
  margin-bottom: 5px;
}

.nav .fa-fw {
  display: inline-block;
  font-size: 12px;
  margin-right: 4px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  line-height: 28px;
  color: var(--text-color--default);
  background: var(--bg-color--semi-light);
}

.nav a.current {
  font-weight: 500;
  color: var(--text-color--markdown-link);
}

.nav a.current .fa-fw {
  color: #fff;
  background: var(--text-color--markdown-link);
}

.nav sup {
  font-weight: bold;
  color: #fff;
  background: var(--text-color--markdown-link);
  border-radius: 4px;
  padding: 1px 4px 2px;
  font-size: 9px;
  font-weight: bold;
}

.alternatives {
  color: var(--text-color--pretty-light);
  margin: 0 0 10px;
}

.alternatives .search-engine {
  display: inline-block;
  margin: 0 3px;
  position: relative;
  top: 5px;
}

.alternatives .search-engine:first-of-type {
  margin-left: 4px;
}

.alternatives .search-engine:hover {
  text-decoration: none;
}

.alternatives .search-engine img {
  display: inline-block;
  width: 18px;
  height: 18px;
  object-fit: cover;
  image-rendering: -webkit-optimize-contrast;
}

ctzn-record-feed,
ctzn-sites-list {
  margin-bottom: 10px;
}

ctzn-record-feed {
  --ctzn-record-feed--default-margin: 20px;
}

.intro {
  margin: 10px 0;
}

.intro .explainer {
  padding: 10px;
  font-size: 18px;
  text-align: center;
}

.intro h4 {
  font-size: 21px;
  margin: 22px 0 10px;
}

.intro a {
  color: var(--text-color--link);
  cursor: pointer;
}

.intro a:hover {
  text-decoration: underline;
}

.intro button {
  font-size: 15px;
}

.intro .sign-in {
  background: var(--bg-color--secondary);
  padding: 10px;
  width: 200px;
  margin: 0 auto;
  text-align: center;
}

.intro .sign-in button {
  margin-right: 5px;
}

.empty {
  font-size: 16px;
  letter-spacing: 0.7px;
  color: var(--text-color--light);
  padding: 160px 0px 170px;
  background: var(--bg-color--default);
  text-align: center;
  margin: 10px 0;
}

.empty :-webkit-any(.fas, .far) {
  font-size: 58px;
  color: var(--text-color--very-light);
  margin: 0 0 30px;
}

.reload-page {
  background: var(--bg-color--secondary);
  text-align: center;
  margin: 8px 0 8px 45px;
  border-radius: 4px;
  color: var(--text-color--link);
  font-size: 15px;
  cursor: pointer;
  overflow: hidden;
  line-height: 40px;

  transition: height 0.2s;
  height: 0px;
}

.reload-page.visible {
  height: 40px;
}

.reload-page:hover {
  text-decoration: underline;
}

`
export default cssStr