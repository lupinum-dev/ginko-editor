import { describe, expect, it } from 'vitest'
import { GinkoEditorScaffold } from '../src/index.js'

describe('package entry', () => {
  it('exports the temporary Vue smoke component', () => {
    expect(GinkoEditorScaffold).toBeTruthy()
  })
})
