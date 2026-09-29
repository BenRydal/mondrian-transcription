import { zip, type AsyncZipOptions, type AsyncZippable } from 'fflate'

export function zipBlob(files: AsyncZippable, options: AsyncZipOptions = {}): Promise<Blob> {
  return new Promise((resolve, reject) =>
    zip(files, options, (err, data) =>
      err
        ? reject(err)
        : resolve(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' }))
    )
  )
}
