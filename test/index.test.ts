import { describe, expect, it } from 'vitest'
import { createAuthoringKit, GinkoEditor } from '../src/index.js'

describe('package entry', () => {
  it('exports the editor component', () => {
    expect(GinkoEditor).toBeTruthy()
    expect(createAuthoringKit).toBeTypeOf('function')
  })
})
