import axios from "axios";
import { fetch } from '..';
import { GameRelease, ICytrus, IFile, IFragments, IGame, Platform, Release } from "./ICytrus";

export default class Cytrus {
  public static readonly CYTRUS_URL = 'http://jsdlaurent-linux:3002/cytrus';
  public static readonly CYTRUS_URL_INTERNAL = 'https://cytrus.ankama.lan';
  public static readonly CYTRUS_URL_PROD = 'https://ankama.akamaized.net/zaap/cytrus';

  private cytrus: ICytrus;

  constructor(
    private baseUrl: string = Cytrus.CYTRUS_URL_PROD,
  ) { }

  public async updateCytrus(): Promise<ICytrus> {
    const response = await axios(this.baseUrl + '/cytrus.json');
    this.cytrus = response.data;
    return this.cytrus;
  }

  public getAllGames(): Array<{ name: string, game: IGame }> {
    const games: Array<{ name: string, game: IGame }> = [];
    for (const gameName of Object.keys(this.cytrus.Games)) {
      games.push({
        name: gameName,
        game: games[gameName],
      });
    }
    return games;
  }

  public getGame(gameName: string): IGame {
    if (!this.cytrus) {
      throw new Error("You should always call updateCytrus() before accessing data")
    }
    const game = this.cytrus.Games[gameName];
    if (!game) {
      throw new Error(`The game ${gameName} does not exists`);
    }
    return game;
  }

  public getPlatform(gameName: string, platform: Platform): Record<Release, string> {
    const game = this.getGame(gameName);
    const platformData = game.Platforms[platform];
    if (!platformData) {
      throw new Error(`Platform ${platform} does not exists for the game ${gameName}`);
    }
    return platformData;
  }

  public getAvailablePlatforms(gameName: string): Platform[] {
    const game = this.getGame(gameName);
    return Object.keys(game.Platforms) as Platform[];
  }

  public getAvailableReleases(gameName: string, platform: Platform): Release[] {
    const platformData = this.getPlatform(gameName, platform);
    return Object.keys(platformData) as Release[];
  }

  public getReleaseVersion(gameName: string, release: Release, platform: Platform): string {
    const platformData = this.getPlatform(gameName, platform);
    const releaseVersion = platformData[release];
    if (!releaseVersion) {
      throw new Error(`There is no ${release} release for ${gameName} on ${platform}`);
    }
    return releaseVersion;
  }

  public async getGameRelease(gameName: string, release: Release, platform: Platform, version: string): Promise<GameRelease> {
    const response = await axios(`${this.baseUrl}/${gameName}/releases/${release}/${platform}/${version}.json`);
    return response.data;
  }

  public async getAllFragments(gameName: string, release: Release, platform: Platform): Promise<Record<string, IFragments>> {
    const releaseVersion = this.getReleaseVersion(gameName, release, platform);
    return this.getGameRelease(gameName, release, platform, releaseVersion);
  }


  public async getFragments(gameName: string, release: Release, platform: Platform, fragmentName: string): Promise<IFragments> {
    const allFragments = await this.getAllFragments(gameName, release, platform);
    const fragments = allFragments[fragmentName];
    if (!fragments) {
      throw new Error(`There is no ${fragmentName} fragment for the ${release} release for ${gameName} on ${platform}`);
    }
    return fragments;
  }

  public getDownloadHandler(gameName: string, file: IFile, filepath: string) {
    const url = `${this.baseUrl}/${gameName}/hashes/${file.Hash.slice(0, 2)}/${file.Hash}`;
    return () => {
      const cp = fetch(url, filepath, file);
      return cp;
    }
  }
}
