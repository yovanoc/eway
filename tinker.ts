import ControllablePromise from "./src/promises/ControllablePromise";
import ControllablePromiseQueue from "./src/promises/ControllablePromise/Queue";

const onError = (error: any) => {
  // tslint:disable-next-line:no-console
  console.log(error);
  process.exit(-1);
};

process.on('uncaughtException', onError);
process.on('unhandledRejection', onError);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const pq = new ControllablePromiseQueue({ concurrency: 4 });

  const first = () => new ControllablePromise<number>((resolve) => {
    sleep(3000).then(() => {
      // tslint:disable-next-line:no-console
      console.log('#1: ', "Seconds: ", new Date().getSeconds(), "Outgoing: ", pq.ongoingCount, "Waiting: ", pq.waitingCount);
      resolve(42)
    })
  })

  const second = () => new ControllablePromise<number>((resolve) => {
    sleep(1500).then(() => {
      // tslint:disable-next-line:no-console
      console.log('#2: ', "Seconds: ", new Date().getSeconds(), "Outgoing: ", pq.ongoingCount, "Waiting: ", pq.waitingCount);
      resolve(42)
    })
  })

  const promises = [first, second, second, second, first, second, second, first, second];

  pq.pause();

  pq.add(first);

  pq.add(promises);

  pq.resume();

  pq.add(first).add(second).add(first);

  pq.pause();

  pq.add(first).add(second).resume();

  await sleep(2000);

  pq.pause();

  await sleep(1000);

  pq.resume();

  pq.add(promises);
};

const controllable = async () => {
  const cp = new ControllablePromise<number>(async (resolve, reject, progress, onPause, onResume, onCancel) => {
    sleep(3000).then(() => resolve(42));

    onPause((resolvePause) => {
      // tslint:disable-next-line:no-console
      console.log("PAUSED!!");
      resolvePause();
    })
    onResume((resolveResume) => {
      // tslint:disable-next-line:no-console
      console.log("RESUMED!!");
      resolveResume();
    })
    onCancel((resolveCancel) => {
      // tslint:disable-next-line:no-console
      console.log("CANCELED!!");
      resolveCancel();
    })

    const total = 10;
    for (let i = 0; i < total; i++) {
      await sleep(300);
      progress({ current: i, total })
    }
  });

  // tslint:disable-next-line:no-console
  const test = () => console.log(new Date(), 'test');

  // tslint:disable-next-line:no-console
  cp.onProgress(stats => console.log("Stats : ", stats))

  setTimeout(() => {
    cp.pause();
  }, 400)

  setTimeout(() => {
    cp.resume();
  }, 1300)

  setTimeout(() => {
    cp.cancel();
  }, 2000)

  try {
    const x = await cp;
    // tslint:disable-next-line:no-console
    console.log("Result : ", x)
  } catch (error) {
    // tslint:disable-next-line:no-console
    console.log("Error : ", error.message)
  } finally {
    // test();
  }
}

main();
// controllable();
