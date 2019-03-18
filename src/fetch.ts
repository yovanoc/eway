import axios, { AxiosResponse } from "axios";
import * as fs from "fs";
import { ControllablePromise } from ".";
import { getFileHash } from "./cryptoHelper";
export const TIMEOUT = 2000;
export const MAX_RETRY = 10;

export const RETRY_ERROR_CODES = [
  "ECONNRESET",
  "EPIPE",
  "ENOTFOUND",
  "ENOENT",
  "ENOTFOUND",
  "ECONNABORTED",
  "EAI_AGAIN",
  "EADDRINUSE"
];

export interface IFile {
  hash: string;
  size: number;
}

export function isRetryError(error: any): boolean {
  return RETRY_ERROR_CODES.includes(error.code);
}

export function fetch(
  subpath: string,
  filepath: string,
  fileData: IFile,
  checkHash = true,
  checkSize = true,
): ControllablePromise<void> {
  const { size: expectedSize } = fileData;

  const cp = new ControllablePromise<void>(
    (resolve, reject, progress, onPause, onResume, onCancel) => {
      const url = subpath;
      const headers: any = {}; // TODO: Put host in headers

      let rs: NodeJS.ReadStream | null = null;
      let ws: fs.WriteStream | null = null;
      let size = 0;
      let isCancelable = true;

      let shouldResume = fs.existsSync(filepath);

      const cleanAndRetry = () => {
        delete headers.Range;
        try {
          fs.unlinkSync(filepath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            // tslint:disable-next-line:no-console
            console.log(`fetch: cannot remove file ${filepath}`, error);
            return reject(error);
          }
        }
        startDownload();
      };

      const onResponse = (res: AxiosResponse<any>) => {
        if (cp.isSettled || cp.isPaused || rs) {
          return;
        }

        if (
          shouldResume &&
          fs.existsSync(filepath) &&
          fs.statSync(filepath).size === expectedSize
        ) {
          return resolve();
        }

        if (res.status === 416) {
          // tslint:disable-next-line:no-console
          console.log(
            `fetch: error 416: range ${
              headers.Range
            } unsatisfiable for ${filepath} (${expectedSize} bytes)`
          );
          return cleanAndRetry();
        }

        if (res.status !== 206 && res.status !== 200) {
          return reject(new Error(`Code: ${res.status}`));
        }

        if (shouldResume && res.headers["accept-ranges"] !== "bytes") {
          return reject(new Error("Partial content not supported"));
        }

        rs = res.data as NodeJS.ReadStream;

        ws = fs.createWriteStream(filepath, {
          flags: shouldResume ? "a" : "w"
        });

        rs.on("data", chunk => {
          size += chunk.length;
          progress({
            chunkSize: chunk.length,
            downloadedSize: size
          });
        });

        ws.once("finish", () => {
          if (
            fs.existsSync(filepath)
          ) {
            if (checkSize === true
                && fs.statSync(filepath).size !== expectedSize) {
                reject(new Error("Downloaded file has not the expected size"));
            }
            isCancelable = false;
            if (!checkHash) {
              return resolve();
            }

            getFileHash(filepath)
              .then(computedHash => {
                if (computedHash === fileData.hash) {
                  return resolve();
                }
                // tslint:disable-next-line:no-console
                console.log(
                  `fetch: computed hash differ from expected hash ${
                    fileData.hash
                  }`
                );
                cleanAndRetry();
              })
              .catch(reject);
          } else if (!cp.isPaused) {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
            reject(new Error("Downloaded file could not be read."));
          }
        });

        rs.once("error", error => {
          // tslint:disable-next-line:no-console
          console.log("fetch", error);
          ws!.end(() => {
            reject(error);
          });
        });

        ws.once("error", error => {
          // tslint:disable-next-line:no-console
          console.log("fetch", error);
          rs!.destroy();
          reject(error);
        });

        rs.pipe(ws);
      };

      const startDownload = (retryCount = 0) => {
        shouldResume = fs.existsSync(filepath);
        if (shouldResume) {
          size = fs.statSync(filepath).size;
          // tslint:disable-next-line:no-console
          // console.log("Size = ", size, !!size);
          if (!!size) {
            Object.assign(headers, { Range: `bytes=${size}-` });
          } else {
            shouldResume = false;
          }
        }

        axios
          .get(url, {
            headers,
            responseType: "stream",
            timeout: TIMEOUT * (retryCount + 1),
            validateStatus: status => {
              return (status >= 200 && status < 300) || status === 416;
            }
          })
          .then(onResponse)
          .catch(error => {
            const shouldRetry = retryCount < MAX_RETRY && isRetryError(error);

            if (shouldRetry) {
              startDownload(retryCount + 1);
            } else {
              reject(error);
            }
          });
      };

      startDownload();

      onPause((resolvePause, rejectPause) => {
        try {
          if (rs) {
            rs.unpipe(ws!);
            rs.destroy();
            rs = null;
          }
          if (ws) {
            ws.end();
          }
          resolvePause();
        } catch (error) {
          rejectPause(error);
        }
      });

      onResume((resolveResume, rejectResume) => {
        try {
          shouldResume = true;
          startDownload();
          resolveResume();
        } catch (error) {
          rejectResume(error);
        }
      });

      onCancel((resolveCancel, rejectCancel) => {
        if (!isCancelable) {
          return rejectCancel(
            new Error(`${fileData.hash} is no longer cancellable`)
          );
        }

        try {
          if (rs) {
            rs.unpipe();
            rs.destroy();
            rs = null;
          }

          new Promise(resolveEnd => (!!ws ? ws.end(resolveEnd) : resolveEnd()))
            .then(() => {
              if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
              }
              resolveCancel();
            })
            .catch(rejectCancel);
        } catch (error) {
          rejectCancel(error);
        }
      });
    }
  );

  return cp;
}
