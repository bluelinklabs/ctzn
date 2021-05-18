import { compileKeyGenerator } from './schemas.js'

export const keyGenerators = {
  unique: compileKeyGenerator([{type: 'auto'}]),
  fungible: compileKeyGenerator([{type: 'json-pointer', value: '/owner/userId'}])
}