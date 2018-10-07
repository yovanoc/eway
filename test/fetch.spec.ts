import { assert } from "chai";

import { lstatSync } from "fs";
import { join } from "path";
import { fetch } from "../src";

describe("Fetch", () => {
  const url =
    "http://192.168.113.152:3002/cytrus/dofus/hashes/eb/ebe61384adad5baad6271811c48323dbd4a7336e";
  const path = join(__dirname, "./SmileyCategories.d2o");
  const file = {
    hash: "ebe61384adad5baad6271811c48323dbd4a7336e",
    size: 14268822
  };

  it("downloaded file should have the expected size", done => {
    const cp = fetch(url, path, file);

    // tslint:disable-next-line:no-console
    // cp.onProgress(stats => console.log("stats", stats))
    cp.then(() => {
      assert.strictEqual(lstatSync(path).size, file.size);
      done();
    });
  });
});
