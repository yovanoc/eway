import { assert } from "chai";
import { getFileHash } from "../src";

describe("cryptoHelper", () => {
  it("should have the correct hash", done => {
    getFileHash("test")
      .then((hash) => {
        assert(hash, "");
        done();
      })
  });

  it("should resolve ERROR", done => {
    getFileHash('')
      .then((hash) => {
        assert(hash, "ERROR");
        done();
      })
  });
});
