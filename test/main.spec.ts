import { expect } from "chai";
import "mocha";

import { ControllablePromise } from "../src/"

describe("ControllablePromise", () => {
  it("should create a ControllablePromise", (done) => {
    const cp = new ControllablePromise<number>((resolve) => {
      resolve(42)
    })
      .then((result) => {
        expect(result).to.eq(42);
        done()
      })
    expect(cp).to.be.not.undefined;
  })
});
