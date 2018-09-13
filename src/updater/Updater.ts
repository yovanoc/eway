import { dirname, join } from 'path';
import { interval } from 'rxjs';
import { ControllablePromise, ControllablePromiseQueue } from '..';
import Cytrus from "./Cytrus";
import { ICytrus, Platform, Release } from "./ICytrus";
import { mkdirp } from './mkdirp';

export interface IFileDownload {
  name: string;
  size: number;
  hash: string;
  promise: ControllablePromise<void>;
}

export interface IUpdateGame {
  queue: ControllablePromiseQueue<void>;
  files: IFileDownload[];
}

export default class Updater {
  constructor(
    public cytrus = new Cytrus(Cytrus.CYTRUS_URL_PROD)
  ) { }

  public async updateCytrus(): Promise<ICytrus> {
    return this.cytrus.updateCytrus();
  }

  public async updateGame(
    gameName: string,
    release: Release,
    platform: Platform,
    gameDirectoryPath: string
  ): Promise<IUpdateGame> {
    const cpq = new ControllablePromiseQueue<void>(10);
    cpq.pause()
    const updateGame: IUpdateGame = {
      queue: cpq,
      files: [],
    }
    const allFragments = await this.cytrus.getAllFragments(gameName, release, platform)
    for (const fragmentName of Object.keys(allFragments)) {
      const fragments = allFragments[fragmentName];
      for (const fileName of Object.keys(fragments.Files)) {
        const file = fragments.Files[fileName];
        const filepath = join(gameDirectoryPath, fileName);
        mkdirp(dirname(filepath));
        const cp = cpq.add(this.cytrus.getDownloadHandler(gameName, file, filepath))
        updateGame.files.push({
          name: fileName,
          size: file.Size,
          hash: file.Hash,
          promise: cp,
        })
      }
    }
    return updateGame;
  }

  public test() {
    return interval(1000)
  }
}
