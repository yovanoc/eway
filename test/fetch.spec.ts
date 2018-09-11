import { assert } from "chai";

import { join } from "path";
import { ControllablePromise, fetch } from "../src"
import { IFileData } from "../src/fetch";
import ControllablePromiseQueue from "../src/promises/ControllablePromise/NewQueue";

describe("Fetch", () => {
  it("should work x)", function (done) {
    this.timeout(10000)
    const cp = fetch(
      "http://192.168.113.152:3002/cytrus/dofus/hashes/eb/ebe61384adad5baad6271811c48323dbd4a7336e",
      join(__dirname, "./SmileyCategories.d2o"),
      {
        hash: "ebe61384adad5baad6271811c48323dbd4a7336e",
        size: 14268822,
      },
    )

    // cp.cancel();

    // tslint:disable-next-line:no-console
    cp.onProgress(stats => console.log("stats", stats))
    cp
      .then(() => {
        // tslint:disable-next-line:no-console
        console.log("downloaded!")
        assert(false)
        done()
      })
      .catch((error) => {
        // tslint:disable-next-line:no-console
        console.log("error!", error)
        assert(false);
        done();
      })
  })
  it.only("Queue TEST", function (done) {
    const MAX = 200;
    let current = MAX;

    this.timeout(MAX * 1500)

    const round = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)

    const pq = new ControllablePromiseQueue<void>(5, MAX);

    const filedata: IFileData = {
      hash: "ebe61384adad5baad6271811c48323dbd4a7336e",
      size: 14268822,
    }

    let overallCurrentDownloadedSize = 0;
    const overallSize = filedata.size * MAX;

    setInterval(() => {
      // tslint:disable-next-line:no-console
      console.log(`Queue: => Waiting (${pq.getQueueLength()}) | Outgoing (${pq.getPendingLength()})`)
      // tslint:disable-next-line:no-console
      console.log(`Overall Progress (${round(overallCurrentDownloadedSize)} MB/${round(overallSize)} MB) => ${(overallCurrentDownloadedSize / overallSize * 100).toFixed(2)}%`)
    }, 500)

    const promiseToAdd = (num: number) => () => {
      const cp = fetch(
        "http://192.168.113.152:3002/cytrus/dofus/hashes/eb/ebe61384adad5baad6271811c48323dbd4a7336e",
        join(__dirname, `./tmp/SmileyCategories_${num}.d2o`),
        filedata
      )

      cp.onProgress((stats) => {
        // tslint:disable-next-line:no-console
        console.log(`#${num} => Progress (${stats.downloadedSize}/${filedata.size}) => ${(stats.downloadedSize / filedata.size * 100).toFixed(2)}%`)
        overallCurrentDownloadedSize += stats.chunkSize;
      })

      cp.then(() => {
        // tslint:disable-next-line:no-console
        console.log(`#${num} => Finished!`)
        current--;
        if (current === 0) {
          done();
        }
      })

      return cp;
    }

    const promises: Array<() => ControllablePromise<void>> = [];
    for (let i = 0; i < MAX; i++) {
      promises.push(promiseToAdd(i));
    }

    for (const p of promises) {
      const realP = pq.add(p)
      realP.then(() => {
        // tslint:disable-next-line:no-console
        // console.log(`--------------- Finished! -------------`)
      })
    }
  })
})
