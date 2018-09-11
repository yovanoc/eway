import { assert } from "chai";

import { join } from "path";
import { fetch } from "../src"

describe.only("Fetch", () => {
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
})
