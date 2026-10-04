import { strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { unzipAsync, zipBlob } from './zip'

const bytes = async (files: Record<string, string>) =>
  new Uint8Array(
    await (
      await zipBlob(Object.fromEntries(Object.entries(files).map(([n, t]) => [n, strToU8(t)])))
    ).arrayBuffer()
  )

describe('unzipAsync', () => {
  it('returns every member by default', async () => {
    const files = await unzipAsync(await bytes({ 'a.txt': 'A', 'b.txt': 'B' }))
    expect(Object.keys(files)).toEqual(['a.txt', 'b.txt'])
  })

  // A session archive is identified from session.json alone, so the filter has to keep
  // the rest — which may be hundreds of megabytes of video — out of memory.
  it('inflates only the members a filter keeps', async () => {
    const files = await unzipAsync(
      await bytes({ 'session.json': '{}', 'big.bin': 'x'.repeat(500) })
    )
    const filtered = await unzipAsync(
      await bytes({ 'session.json': '{}', 'big.bin': 'x'.repeat(500) }),
      (entry) => entry.name === 'session.json'
    )
    expect(Object.keys(files)).toEqual(['session.json', 'big.bin'])
    expect(Object.keys(filtered)).toEqual(['session.json'])
  })

  it('rejects data that is not a ZIP', async () => {
    await expect(unzipAsync(strToU8('not a zip'))).rejects.toBeTruthy()
  })
})
