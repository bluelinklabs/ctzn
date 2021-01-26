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
  content-visibility: auto;
  contain-intrinsic-size: 610px 115px;

  --text-color--post-content: var(--text-color--default);
}

a {
  text-decoration: none;
  cursor: initial;
}

a:hover {
  text-decoration: underline;
  cursor: pointer;
}

.post .favicon {
  display: block;
  width: 16px;
  height: 16px;
  object-fit: cover;
  border-radius: 50%;
  margin-right: 8px;
  font-size: 14px;
}

.post .title a {
  color: var(--color-text--default);
}

.vote-ctrl :-webkit-any(.far, .fas) {
  font-size: 13px;
}

.vote-ctrl a {
  display: inline-block;
  padding: 0 4px;
  border-radius: 4px;
  margin-right: 18px;
  color: var(--text-color--pretty-light);
}

.vote-ctrl a.pressed {
  font-weight: bold;
  color: var(--text-color--link);
}

.vote-ctrl a:hover {
  text-decoration: none;
  background: var(--bg-color--semi-light);
}

.vote-ctrl .count {
  font-size: 13px;
}

.comment-ctrl {
  display: inline-block;
  padding: 0 4px;
  border-radius: 4px;
  margin-right: 18px;
  color: var(--text-color--pretty-light);
}

.comment-ctrl:hover {
  text-decoration: none;
  background: var(--bg-color--semi-light);
}

.comment-ctrl .far {
  margin-right: 2px;
  font-size: 12px;
}

.notification {
  padding: 5px 4px 4px 48px;
  margin-right: 19px;
  font-size: 14px;
  color: var(--text-color--default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification.unread {
  background: var(--bg-color--unread);
}

.notification a {
  color: var(--text-color--light);
}

:host([render-mode="comment"]) .notification {
  padding: 0 12px 5px;
}

.image-loading {
  width: 14px;
  height: 14px;
  background: url(${unsafeCSS((new URL('../../img/spinner.gif', import.meta.url)).toString())});
  background-size: 100%;
}

/** CARD STYLES **/

.post.card {
  position: relative;
  display: grid;
  grid-template-columns: 45px 1fr;
  color: var(--text-color--lightish);
}

.post.card.unread {
  background: var(--bg-color--unread);
  box-shadow: 0 0 0 5px var(--bg-color--unread);
  margin-bottom: 5px;
  border-radius: 1px;
}

.post.card .info {
  display: flex;
  align-items: center;
}

.post.card .thumb {
  display: block;
  width: 30px;
  height: 30px;
  background: var(--bg-color--semi-light);
  border-radius: 50%;
  position: relative;
  top: 8px;
}

.post.card .thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post.card .arrow {
  content: '';
  display: block;
  position: absolute;
  top: 20px;
  left: 41px;
  width: 8px;
  height: 8px;
  z-index: 10;
  background: var(--bg-color--default);
  border-top: 1px solid var(--border-color--very-light);
  border-left: 1px solid var(--border-color--very-light);
  transform: rotate(-45deg);
}

.post.card.is-notification .arrow {
  background: var(--bg-color--light);
}

.post.card.unread .arrow {
  border-color: var(--border-color--unread);
}

.post.card .container {
  border: 1px solid var(--border-color--very-light);
  border-radius: 4px;
  background: var(--bg-color--default);
  padding: 2px;
  min-width: 0; /* this is a hack to make the overflow: hidden work */
}

.post.card .container:hover {
  cursor: pointer;
  border-color: var(--border-color--dark);
}

.post.card.unread .container {
  background: transparent;
  border-color: var(--border-color--unread);
}

.post.card .header {
  display: flex;
  align-items: baseline;
  font-size: 14px;
  padding: 8px 12px 6px;
  color: var(--text-color--light);
}

.post.card .header > * {
  margin-right: 5px;
  white-space: nowrap;
}

.post.card .origin .icon {
  margin-right: 5px;
}

.post.card .header a {
  color: inherit;
}

.post.card .origin .author {
}

.post.card .origin .author.displayname {
  color: var(--text-color--default);
  font-weight: 600;
  font-size: 15px;
}

.post.card .title {
  font-weight: normal;
  letter-spacing: 0.5px;
}

.post.card .title a {
  color: var(--text-color--result-link);
}

.post.card .context {
  padding: 0px 12px 5px;
  color: var(--text-color--pretty-light);
}

.post.card .content {
  white-space: initial;
  word-break: break-word;
  color: var(--text-color--post-content);
  line-height: 1.3125;
  font-size: 15px;
  letter-spacing: 0.1px;
  padding: 0px 12px;
}

.post.card .content > :first-child { margin-top: 0; }
.post.card .content > :last-child { margin-bottom: 0; }

.post.card .ctrls {
  padding: 8px 12px;
  font-size: 12px;
}

.post.card ctzn-composer {
  display: block;
  padding: 10px;
}

:host([noborders]) .post.card {
  grid-template-columns: 34px 1fr;
}

:host([noborders]) .post.card .thumb {
  margin: 5px 0 0;
  width: 36px;
  height: 36px;
}

:host([noborders]) .post.card .arrow,
:host([nothumb]) .post.card .arrow {
  display: none;
}

:host([noborders]) .post.card .container {
  border-color: transparent !important;
  background: none;
}

:host([nothumb]) .post.card {
  display: block;
}

:host([nothumb]) .post.card .thumb {
  display: none;
}

:host([noborders]) .post.card ctzn-composer {
  margin-left: -36px;
}

/** COMMENT STYLES **/

.post.comment {
  position: relative;
  padding: 10px 14px 8px;
  border-radius: 4px;
}

.post.comment::before {
  content: "";
  display: block;
  position: absolute;
  left: 19px;
  top: 32px;
  width: 1px;
  height: calc(100% - 32px);
  background: var(--border-color--semi-light);
}

.post.comment.unread {
  background: var(--bg-color--unread);
  box-shadow: 0 0 0 5px var(--bg-color--unread);
  border-radius: 1px;
  border: 1px solid var(--border-color--unread);
}

.post.comment .header {
  display: flex;
  align-items: center;
  font-size: 13px;
  padding: 0 0 4px;
}

.post.comment .header > * {
  margin-right: 5px;
  white-space: nowrap;
}

.post.comment .header a {
  color: var(--text-color--light);
}

.post.comment .thumb {
  width: 14px;
  height: 14px;
  background: var(--bg-color--semi-light);
  border-radius: 50%;
}

.post.comment .thumb img {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: cover;
}

.post.comment .origin .author {
  color: var(--text-color--default);
}

.post.comment .title {
  font-weight: normal;
  letter-spacing: 0.5px;
}

.post.comment .title a {
  color: var(--text-color--result-link);
}

.post.comment .action {
  color: var(--text-color--light);
}

.post.comment .context {
  box-sizing: border-box;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post.comment .content {
  white-space: initial;
  color: var(--text-color--default);
  line-height: 1.3125;
  font-size: 14px;
  letter-spacing: 0.1px;
  padding-left: 18px;
}

.post.comment.constrain-height .content {
  max-height: 50px;
  overflow: hidden;
}

.post.comment .content > :first-child { margin-top: 0; }
.post.comment .content > :last-child { margin-bottom: 0; }

.post.comment .read-more {
  padding: 4px 18px 0;
}

.post.comment .read-more a {
  color: var(--text-color--link);
}

.post.comment .ctrls {
  padding: 6px 0 0 18px;
}

.post.comment .ctrls a {
  display: inline-block;
  color: var(--text-color--light);
  font-size: 13px;
}

.post.comment .ctrls a:hover {
  cursor: pointer;
  color: var(--text-color--default);
}

.post.comment .ctrls a.reply {
  margin-right: 18px;
}

.post.comment .ctrls a :-webkit-any(.far, .fas) {
  color: var(--text-color--very-light);
}

.post.comment .ctrls a .fa-tag {
  color: transparent;
  -webkit-text-stroke: 1px var(--text-color--very-light);
}

.post.comment .ctrls a small {
  position: relative;
  top: -1px;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.post.comment ctzn-composer {
  display: block;
  padding: 10px 20px;
}

`
export default cssStr