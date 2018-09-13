export type Platform = 'darwin' | 'linux' | 'windows';
export type Asset = 'installed' | 'meta' | 'notInstalled';
export type Game = string;
export type Release = string;

export interface IGame {
  Name: string;
  Order: number;
  Assets: Record<Asset, Record<Release, string>>;
  Platforms: Record<Platform, Record<Release, string>>;
}

export interface ICytrus {
  Version: number;
  Name: string;
  Games: Record<Game, IGame>;
}

export interface IFile {
  Hash: string;
  Size: number;
}

export interface IPack {
  Hashes: string[];
  Size: number;
}

export interface IFilesList {
  Files: Record<string, IFile>;
}

export interface IFragments {
  Packs?: Record<string, IPack>;
  Archives?: Record<string, IFilesList>;
  Files: Record<string, IFile>;
}

export type GameRelease = Record<string, IFragments>;
