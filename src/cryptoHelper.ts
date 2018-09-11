import { createHash } from "crypto";
import { createReadStream } from "fs";

export async function getFileHash(absoluteFilePath: string) {
  return new Promise<string>((resolve) => {
    const sha1 = createHash('sha1')
    const stream = createReadStream(absoluteFilePath)

    stream.on('error', () => {
      resolve("ERROR")
    })
    stream.on('data', (data) => {
      sha1.update(data)
    })
    stream.on('end', () => {
      const hash = sha1.digest('hex')
      resolve(hash)
    })
  })
}
