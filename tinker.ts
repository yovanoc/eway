import { update } from "./src/Updater/test"

try {
  update();
} catch (error) {
  // tslint:disable-next-line:no-console
  console.error(error);
  process.exit(0);
}
