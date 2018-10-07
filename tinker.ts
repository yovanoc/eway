/*
import { update } from "./src/Updater/test"

const onError = (error: any) => {
  const message: string = error.message;
  // tslint:disable-next-line:no-console
  console.log(message, " ====== ", error.code);

  if (message.includes("Downloaded file has not the expected size")) {
    return;
  }

  process.exit(0);
}

process.on("uncaughtException", onError);
process.on("unhandledRejection", onError)

update();
*/

/*
import { fromEvent, merge, of } from "rxjs";
import { mapTo } from "rxjs/operators";

const online = merge(
  of(navigator.onLine),
  fromEvent(window, "online").pipe(mapTo(true)),
  fromEvent(window, "offline").pipe(mapTo(false))
);

online.subscribe(isOnline => {
  // tslint:disable-next-line:no-console
  console.log("Network changed!", isOnline);
});
*/

/*
import { promisePool } from "./src/promises/PromisePool";

const sleep = (ms: number) =>
  new Promise<number>(resolve => setTimeout(() => resolve(ms), ms));

const gen = function*() {
  for (let i = 1; i <= 50; i++) {
    yield sleep(i * 150);
  }
};

const pool = promisePool(gen(), 20);

pool.start().then(num => {
  // tslint:disable-next-line:no-console
  console.log(num);
});
*/
