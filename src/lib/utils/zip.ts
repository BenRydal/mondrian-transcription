import {
  unzip,
  zip,
  type AsyncZipOptions,
  type AsyncZippable,
  type Unzipped,
  type UnzipFileFilter,
} from 'fflate'

export function zipBlob(files: AsyncZippable, options: AsyncZipOptions = {}): Promise<Blob> {
  return new Promise((resolve, reject) =>
    zip(files, options, (err, data) =>
      err
        ? reject(err)
        : resolve(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' }))
    )
  )
}

/** A `filter` keeps the other members compressed, which matters for archived video. */
export function unzipAsync(data: Uint8Array, filter?: UnzipFileFilter): Promise<Unzipped> {
  return new Promise((resolve, reject) =>
    unzip(data, { filter }, (err, files) => (err ? reject(err) : resolve(files)))
  )
}
