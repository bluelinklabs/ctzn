import {css} from '../../vendor/lit/lit.min.js'

const cssStr = css`
*[data-tooltip] {
  position: relative;
}

*[data-tooltip]:hover:before,
*[data-tooltip]:hover:after {
  display: block;
  z-index: 1000;
  transition: opacity 0.01s ease;
  transition-delay: 0.2s;
}

*[data-tooltip]:hover:after {
  opacity: 1;
}

*[data-tooltip]:hover:before {
  transform: translate(-50%, 0);
  opacity: 1;
}

*[data-tooltip]:before {
  opacity: 0;
  transform: translate(-50%, 0);
  position: absolute;
  top: 33px;
  left: 50%;
  z-index: 3000;
  content: attr(data-tooltip);
  background: rgba(17, 17, 17, 0.95);
  font-size: 0.7rem;
  border: 0;
  border-radius: 4px;
  padding: 7px 10px;
  color: rgba(255, 255, 255, 0.925);
  text-transform: none;
  text-align: center;
  font-weight: 500;
  white-space: pre;
  line-height: 1;
  pointer-events: none;
}

*[data-tooltip]:after {
  opacity: 0;
  position: absolute;
  left: calc(50% - 6px);
  top: 28px;
  content: '';
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid rgba(17, 17, 17, 0.95);
  pointer-events: none;
}

.tooltip-nodelay[data-tooltip]:hover:before,
.tooltip-nodelay[data-tooltip]:hover:after {
  transition-delay: initial;
}

.tooltip-right[data-tooltip]:before {
  top: 50%;
  left: calc(100% + 6px);
  transform: translate(0, -50%);
  line-height: 0.9;
}

.tooltip-right[data-tooltip]:after {
  top: 50%;
  left: calc(100% + 0px);
  transform: translate(0, -50%);
  border: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid rgba(17, 17, 17, 0.95);
}

.tooltip-left[data-tooltip]:before {
  top: 50%;
  left: auto;
  right: calc(100% + 6px);
  transform: translate(0, -50%);
  line-height: 0.9;
}

.tooltip-left[data-tooltip]:after {
  top: 50%;
  left: auto;
  right: calc(100% + 0px);
  transform: translate(0, -50%);
  border: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid rgba(17, 17, 17, 0.95);
}

.tooltip-top[data-tooltip]:before {
  top: unset;
  bottom: 33px;
}

.tooltip-top[data-tooltip]:after {
  top: unset;
  bottom: 28px;
  border: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(17, 17, 17, 0.95);
}
`
export default cssStr
