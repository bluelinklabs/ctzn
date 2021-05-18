import {css} from '../../vendor/lit/lit.min.js'

const cssStr = css`
.dropdown {
  position: relative;

  --text-color--dropdown-default: #333;
  --text-color--dropdown-section: #aaa;
  --text-color--dropdown-icon: rgba(0, 0, 0, 0.65);
  --text-color--dropdown-btn--pressed: #dadada;
  --text-color--title: gray;
  --bg-color--dropdown: #fff;
  --bg-color--dropdown-item--hover: #eee;
  --border-color--dropdown: #dadada;
  --border-color--dropdown-item: #eee;
  --border-color--dropdown-section: rgba(0,0,0,.1);
  --border-color--dropdown-separator: #ddd;
}

@media (prefers-color-scheme: dark) {
  .dropdown {
    --text-color--dropdown-default: #ccd;
    --text-color--dropdown-section: #aaa;
    --text-color--dropdown-icon: #eef;
    --text-color--dropdown-btn--pressed: #2c2c31;
    --text-color--title: gray;
    --bg-color--dropdown: #334;
    --bg-color--dropdown-item--hover: #445;
    --border-color--dropdown: #556;
    --border-color--dropdown-item: #669;
    --border-color--dropdown-section: rgba(0,0,0,.1);
    --border-color--dropdown-separator: #ddd;
  }
}

.dropdown.open .toggleable:not(.primary) {
  background: var(--text-color--dropdown-btn--pressed);
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.1);
  border-color: transparent;
  outline: 0;
}

.toggleable-container .dropdown-items {
  display: none;
}

.toggleable-container.hover:hover .dropdown-items,
.toggleable-container.open .dropdown-items {
  display: block;
}

.dropdown-items {
  width: 270px;
  position: absolute;
  right: 0px;
  z-index: 3000;
  background: var(--bg-color--dropdown);
  color: var(--text-color--dropdown-default);
  border: 1px solid var(--border-color--dropdown);
  border-radius: 0px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
}

.dropdown-items .section {
  border-bottom: 1px solid var(--border-color--dropdown-section);
  padding: 5px 0;
}

.dropdown-items .section-header {
  padding: 2px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-items .section-header.light {
  color: #666;
  font-weight: 500;
}

.dropdown-items .section-header.small {
  font-size: 12px;
  letter-spacing: 0.25px;
}

.dropdown-items hr {
  border: 0;
  border-bottom: 1px solid var(--border-color--dropdown-separator);
}

.dropdown-items.thin {
  width: 170px;
}

.dropdown-items.wide {
  width: 400px;
}

.dropdown-items.compact .dropdown-item {
  padding: 2px 15px;
  border-bottom: 0;
}

.dropdown-items.compact .description {
  margin-left: 0;
}

.dropdown-items.compact hr {
  margin: 5px 0;
}

.dropdown-items.roomy .dropdown-item {
  padding: 10px 15px;
}

.dropdown-items.very-roomy .dropdown-item {
  padding: 16px 40px 16px 20px;
}

.dropdown-items.rounded {
  border-radius: 4px;
}

.dropdown-items.no-border .dropdown-item {
  border-bottom: 0;
}

.dropdown-items.center {
  left: 50%;
  right: unset;
  transform: translateX(-50%);
}

.dropdown-items.left {
  right: initial;
  left: 0;
}

.dropdown-items.over {
  top: 0;
}

.dropdown-items.top {
  bottom: calc(100% + 5px);
}

.dropdown-items.with-triangle:before {
  content: '';
  position: absolute;
  top: -6px;
  right: 10px;
  width: 10px;
  height: 10px;
  z-index: -1;
  transform: rotate(45deg);
  border-left: 1px solid #ddd;
  border-top: 1px solid #ddd;
  background: var(--bg-color--dropdown);
}

.dropdown-items.with-triangle.left:before {
  left: 10px;
}

.dropdown-items.with-triangle.center:before {
  left: 46%;
}

.dropdown-title {
  border-bottom: 1px solid var(--border-color--dropdown-item);
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-color--title);
}

.dropdown-item {
  display: block;
  padding: 7px 15px;
  border-bottom: 1px solid var(--border-color--dropdown-item);
}

.dropdown-item.disabled {
  opacity: 0.25;
}

.dropdown-item.no-border {
  border-bottom: 0;
}

.dropdown-item.selected {
  background: var(--bg-color--dropdown-item--hover);  
}

.dropdown-item:hover:not(.no-hover) {
  background: var(--bg-color--dropdown-item--hover);
  cursor: pointer;
}

.dropdown-item:hover:not(.no-hover) i:not(.fa-check-square) {
  color: var(--text-color--dropdown-default);
}

.dropdown-item:hover:not(.no-hover) .description {
  color: var(--text-color--dropdown-default);
}

.dropdown-item:hover:not(.no-hover).disabled {
  background: inherit;
  cursor: default;
}

.dropdown-item .fa,
.dropdown-item i {
  display: inline-block;
  width: 20px;
  color: var(--text-color--dropdown-icon);
}

.dropdown-item .fa-fw {
  margin-left: -3px;
  margin-right: 3px;
}

.dropdown-item img:not(.emoji) {
  display: inline-block;
  width: 16px;
  position: relative;
  top: 3px;
  margin-right: 6px;
}

.dropdown-item img.rounded {
  border-radius: 50%;
}

.dropdown-item .btn .fa {
  color: inherit;
}

.dropdown-item .label {
  font-weight: 500;
}

.dropdown-item .description {
  color: rgb(102, 102, 102);
  margin: 0px 0px 3px 27px;
}

.dropdown-item .label.truncate,
.dropdown-item .description.truncate {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 640px) {
  .dropdown-item .label.truncate,
  .dropdown-item .description.truncate {
    max-width: 240px;
  }
}

.dropdown-item .description.small {
  font-size: 12.5px;
}

.dropdown-item:first-of-type {
  border-radius: 2px 2px 0 0;
}

.dropdown-item:last-of-type {
  border-radius: 0 0 2px 2px;
}

.dropdown-item .img-wrapper {
  display: flex;
  align-items: center;
}

.dropdown-item .img-wrapper img:not(.emoji) {
  display: block;
  top: 0;
  height: 40px;
  width: 40px;
  margin-right: 15px;
}

.dropdown-item .img-wrapper .description {
  margin-left: 0;
}

.emoji {
  display: inline-block;
  width: 1rem;
}
`
export default cssStr
