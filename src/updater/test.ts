import * as Listr from 'listr';
import { join } from 'path';
import Updater, { IUpdateGame } from '.';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function update() {

  let updateGame: IUpdateGame = null;

  const updater = new Updater();

  const xcytrus = await updater.updateCytrus();

  const games = updater.cytrus.getAllGames();

  const tasks: Listr.ListrTask[] = [];

  for (const game of games.filter(g => g.name === "wakfu")) {
    const gameTask = new Listr();
    const availablePlatforms = updater.cytrus.getAvailablePlatforms(game.name);
    for (const platform of availablePlatforms.filter(p => p === "windows")) {
      const platformTask = new Listr();
      const availableReleases = updater.cytrus.getAvailableReleases(game.name, platform);
      for (const release of availableReleases.filter(r => r === "main")) {
        const releaseTask = new Listr();
        const gameDirectoryPath = join(__dirname, "games", game.name, platform, release);
        updateGame = await updater.updateGame(game.name, release, platform, gameDirectoryPath);

        for (const file of updateGame.files.slice(0, 60)) {
          releaseTask.add({
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
        platformTask.add({ title: release, task: () => releaseTask });
      }
      gameTask.add({ title: platform, task: () => platformTask });
    }
    tasks.push({ title: game.name, task: () => gameTask });
  }

  const listr = new Listr(tasks, { concurrent: true })

  listr.run();

  updateGame.queue.start();
}
