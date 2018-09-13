// tslint:disable-next-line:no-reference
///<reference path="../node_modules/electron/electron.d.ts"/>
// @ts-ignore
import electronFetch, { FetchError, Response } from "electron-fetch";
import * as fs from "fs"
import { Readable } from "stream";
import { ControllablePromise } from ".";
import { getFileHash } from "./cryptoHelper";
import { IFile } from "./updater/ICytrus";

export const TIMEOUT = 2000
export const MAX_RETRY = 5

export const RETRY_ERROR_CODES = [
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'ENOENT',
  'ENOTFOUND',
  'ECONNABORTED',
  'EAI_AGAIN',
]

export function isRetryError(error: any): boolean {
  return error.type === 'request-timeout' ||
    // @ts-ignore
    (error instanceof FetchError && error.type === 'system' && RETRY_ERROR_CODES.includes(error.code))
}

export function fetch(subpath: string, filepath: string, fileData: IFile, checkHash = true): ControllablePromise<void> {
  const {
    Size: expectedSize,
  } = fileData

  const cp = new ControllablePromise<void>((resolve, reject, progress, onPause, onResume, onCancel) => {
    const url = subpath;
    const headers: any = {} // TODO: Put host in headers

    let rs: Readable = null
    let ws: fs.WriteStream = null
    let size = 0
    let isCancelable = true

    let shouldResume = fs.existsSync(filepath)

    const cleanAndRetry = () => {
      delete headers.Range
      try {
        fs.unlinkSync(filepath)
      } catch (error) {
        if (error.code !== 'ENOENT') {
          // tslint:disable-next-line:no-console
          console.log(`fetch: cannot remove file ${filepath}`, error)
          return reject(error)
        }
      }
      startElectronFetch()
    }

    const onResponse = (res: Response) => {
      if (cp.isSettled || cp.isPaused || rs) {
        return
      }

      if (shouldResume && fs.existsSync(filepath) && fs.statSync(filepath).size === expectedSize) {
        return resolve()
      }

      if (res.status === 416) {
        // tslint:disable-next-line:no-console
        console.log(`fetch: error 416: range ${headers.Range} unsatisfiable for ${filepath} (${expectedSize} bytes)`)
        return cleanAndRetry()
      }

      if (res.status !== 206 && res.status !== 200) {
        return reject(new Error(`Code: ${res.status}`))
      }

      if (shouldResume && res.headers['accept-ranges'] !== 'bytes') {
        return reject(new Error('Partial content not supported'))
      }

      rs = res.body as Readable

      ws = fs.createWriteStream(filepath, {
        flags: shouldResume ? 'a' : 'w',
      })

      rs.on('data', (chunk) => {
        size += chunk.length
        progress({
          chunkSize: chunk.length,
          downloadedSize: size,
        })
      })

      ws.once('finish', () => {
        if (fs.existsSync(filepath) && fs.statSync(filepath).size === expectedSize) {
          isCancelable = false
          if (!checkHash) {
            return resolve()
          }

          getFileHash(filepath)
            .then((computedHash) => {
              if (computedHash === fileData.Hash) {
                return resolve()
              }
              // tslint:disable-next-line:no-console
              console.log(`fetch: computed hash differ from expected hash ${fileData.Hash}`)
              cleanAndRetry()
            })
            .catch(reject)
        } else if (!cp.isPaused) {
          reject(new Error("Downloaded file has not the expected size"));
        }
      })

      rs.once('error', (error) => {
        // logger.error('fetch', error)
        ws.end(() => {
          reject(error)
        })
      })

      ws.once('error', (error) => {
        // logger.error('fetch', error)
        rs.destroy()
        reject(error)
      })

      rs.pipe(ws)
    }

    const startElectronFetch = (retryCount = 0) => {
      shouldResume = fs.existsSync(filepath)
      if (shouldResume) {
        size = fs.statSync(filepath).size
        if (!!size) {
          Object.assign(headers, { Range: `bytes=${size}-` })
        } else {
          shouldResume = false
        }
      }

      electronFetch(url, {
        headers,
        timeout: TIMEOUT * (retryCount + 1),
        useElectronNet: false,
        // responseType: "stream"
      }).then(onResponse)
        .catch((error) => {
          const shouldRetry = retryCount < MAX_RETRY && isRetryError(error)

          if (shouldRetry) {
            /* istanbul ignore next */
            startElectronFetch(retryCount + 1)
          } else {
            reject(error)
          }
        })
    }

    startElectronFetch()

    onPause((resolvePause, rejectPause) => {
      try {
        if (rs) {
          rs.unpipe(ws)
          rs.destroy()
          rs = null
        }
        if (ws) {
          ws.end()
        }
        resolvePause()
      } catch (error) {
        rejectPause(error)
      }
    })

    onResume((resolveResume, rejectResume) => {
      try {
        shouldResume = true
        startElectronFetch()
        resolveResume()
      } catch (error) {
        rejectResume(error)
      }
    })

    onCancel((resolveCancel, rejectCancel) => {
      if (!isCancelable) {
        return rejectCancel(new Error(`${fileData.Hash} is no longer cancellable`))
      }

      try {
        if (rs) {
          rs.unpipe()
          rs.destroy()
          rs = null
        }

        new Promise(resolveEnd => !!ws ? ws.end(resolveEnd) : resolveEnd())
          .then(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath)
            }
            resolveCancel()
          })
          .catch(rejectCancel)
      } catch (error) {
        rejectCancel(error)
      }
    })
  });

  return cp;
}
