import { svg } from '../../vendor/lit/lit.min.js'

export const upArrow = (width = 12, height = 12, strokeWidth = 35) => svg`
  <svg class="inline-block" width=${width} height=${height} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" xmlns:bx="https://boxy-svg.com">
    <path d="M 1321.327 852.661 H 1459.952 L 1459.952 753.132 L 1671.201 936.706 L 1459.952 1120.281 L 1459.952 1020.752 H 1321.327 V 852.661 Z" style="stroke: currentColor; fill: none; stroke-linecap: square; stroke-linejoin: round; stroke-width: ${strokeWidth}px;" transform="matrix(0.007473, -0.999972, 0.999972, 0.007473, -697.861877, 1719.222168)" bx:shape="arrow 1321.327 753.132 349.874 367.149 168.091 211.249 0 1@853d0790"/>
  </svg>
`

export const downArrow = (width = 12, height = 12, strokeWidth = 35) => svg`
  <svg class="inline-block" width=${width} height=${height} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" xmlns:bx="https://boxy-svg.com">
    <path d="M -1321.327 -653.603 H -1182.702 L -1182.702 -753.132 L -971.453 -569.557 L -1182.702 -385.983 L -1182.702 -485.512 H -1321.327 V -653.603 Z" style="stroke: currentColor; fill: none; stroke-linecap: square; stroke-linejoin: round; stroke-width: ${strokeWidth}px;" transform="matrix(0.007473, 0.999972, 0.999972, -0.007473, 828.108398, 1372.10144)" bx:shape="arrow -1321.327 -753.132 349.874 367.149 168.091 211.249 0 1@a091787f"/>
  </svg>
`