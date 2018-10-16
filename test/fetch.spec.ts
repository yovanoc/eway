import { assert } from "chai";
import { lstatSync } from "fs";
import { join } from "path";
import { fetch } from "../src";

describe("Fetch", () => {
  const url =
    "http://cytrus/dofus/hashes/f1/f1c5b227e3c67937bef9f74bf013fc3d03ba3391";
  const path = join(__dirname, "./SmileyCategories.d2o");
  const file = {
    hash: "f1c5b227e3c67937bef9f74bf013fc3d03ba3391",
    size: 700
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
