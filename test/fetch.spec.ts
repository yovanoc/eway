import { assert } from "chai";
import { lstatSync } from "fs";
import { join } from "path";
import { fetch } from "../src";

describe("Fetch", () => {
  const url =
    "https://icons-for-free.com/free-icons/png/512/1337497.png";
  const path = join(__dirname, "./pikachu.png");
  const file = {
    hash: "a7efe3985ca1e5f77b92031cf3f46f41aaeab822",
    size: 45612
  };

  it("downloaded file should have the expected size", done => {
    const cp = fetch(url, path, file);

    // tslint:disable-next-line:no-console
    // cp.onProgress(stats => console.log("stats", stats))
    cp.then(() => {
        console.log(file.size);
        console.log(lstatSync(path).size);
      assert.strictEqual(lstatSync(path).size, file.size);
      done();
    });
  });
});
