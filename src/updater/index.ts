import { dirname, join } from 'path';
import { interval, Observable } from 'rxjs';
import ControllablePromise from '../Promises/ControllablePromise';
import PQueue from '../Promises/PQueue';
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
  queue: PQueue;
  files: IFileDownload[];
}

export default class Updater {
  constructor(
    public cytrus = new Cytrus()
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
    const cpq = new PQueue({ concurrency: 10, autoStart: false });
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

  public updateGameObservable(
    gameName: string,
    release: Release,
    platform: Platform,
    gameDirectoryPath: string
  ): Observable<IUpdateGame> {
    return new Observable<IUpdateGame>((sub) => {
      interval(60000)
        .subscribe(() => {
          this.updateCytrus()
            .then((cytrus) => {
              // check if local and remote are the same?
              if (true) {
                this.updateGame(gameName, release, platform, gameDirectoryPath)
                  .then((updateGame) => {
                    sub.next(updateGame);
                  })
              }
            })
        })
    })
  }
}
