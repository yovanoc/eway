import * as Listr from 'listr';
import { join } from 'path';
import Updater, { IUpdateGame } from './Updater';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function update() {

  let updateGame: IUpdateGame = null;

  const updater = new Updater();

  const xcytrus = await updater.updateCytrus();

  const games = updater.cytrus.getAllGames();

  const tasks: Map<string, Map<string, Map<string, Map<string, Listr.ListrTask>>>> = new Map();

  for (const game of games/*.filter((g) => g.name === "dofus")*/) {
    tasks.set(game.name, new Map());
    const availablePlatforms = updater.cytrus.getAvailablePlatforms(game.name);
    for (const platform of availablePlatforms/*.filter((p) => p === "windows")*/) {
      const gamesTasks = tasks.get(game.name);
      gamesTasks.set(platform, new Map());
      const availableReleases = updater.cytrus.getAvailableReleases(game.name, platform);
      for (const release of availableReleases/*.filter((r) => r === "beta")*/) {
        const platformsTasks = gamesTasks.get(platform);
        platformsTasks.set(release, new Map());
        const gameDirectoryPath = join(__dirname, "games", game.name, platform, release);
        updateGame = await updater.updateGame(game.name, release, platform, gameDirectoryPath);
        const releasesTasks = tasks.get(game.name).get(platform).get(release);

        setInterval(() => {
          // tslint:disable-next-line:no-console
          // console.log(`#(${game.name}-${platform}-${release}) => Pending: ${updateGame.queue.getPendingLength()} | Waiting: ${updateGame.queue.getQueueLength()}`);
        }, 1000)

        for (const file of updateGame.files) {
          releasesTasks.set(file.name, {
            title: file.name,
            task: (ctx, task) => {
              const base = task.title;
              const render = (msg: string) => task.title = `${base}: ${msg}`;
              return new Promise((resolve) => {
                file.promise.onProgress((stats) => render(`${(stats.downloadedSize / file.size * 100).toFixed(2)}%`));
                file.promise.then(() => resolve())
              })
            }
          });
        }
      }
    }
  }

  const tasksParsed: Listr.ListrTask[] = [];

  for (const [game, gameTasks] of tasks.entries()) {
    const gameTask = new Listr();
    for (const [platform, platformsTasks] of gameTasks.entries()) {
      const platformTask = new Listr();
      for (const [release, releasesTasks] of platformsTasks.entries()) {
        const releaseTask = new Listr();
        for (const [file, fileTask] of releasesTasks.entries()) {
          releaseTask.add(fileTask)
        }
        platformTask.add({ title: release, task: () => releaseTask });
      }
      gameTask.add({ title: platform, task: () => platformTask });
    }
    tasksParsed.push({ title: game, task: () => gameTask });
  }

  const listr = new Listr(tasksParsed, { concurrent: true })

  updateGame.queue.resume();

  listr.run();
}
