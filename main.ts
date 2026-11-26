// Token Radar 2 — the entrypoint: one sealed snapshot in, the ranked board out.
//
// The program reads the snapshot of every protocol DefiLlama tracks, scores the
// pre-token ones with the radar-2 model in lib/model.ts, and writes everything the
// gate and the judge read:
//
//   board.json    the ranked board: {"rows": [...]} by implied value, rank 1 first
//   data.js       the dashboard's whole dataset as window.RADAR, no fetch needed
//   dashboard/    a copy of the dashboard's source, as the page ships it
//   screenshots/  a copy of the three screenshots, the first one the cover
//   dossier.json  exactly what buildDossier writes from dashboard/ and screenshots/
//
// Run it as: node main.ts [--input <snapshot.json>]
// The snapshot defaults to /input/snapshot.json; the output directory is the
// MAKEFUN_OUTPUT_DIR environment variable (default /output). Node 22 standard
// library only: nothing is installed, nothing is fetched, nothing leaves the box.

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';

/** Where this file lives: dashboard/ and screenshots/ sit beside it. */
const ROOT = dirname(fileURLToPath(import.meta.url));

/** The snapshot's path: --input <path>, else --input=<path>, else the sealed input. */
function inputPath(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--input' && i + 1 < argv.length) return argv[i + 1]!;
    if (arg.startsWith('--input=')) return arg.slice('--input='.length);
  }
  return '/input/snapshot.json';
}

/** The output directory: the environment's, else the grader's /output. */
function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : '/output';
}

/** Copy a directory tree whole, file by file, so the bytes are the source's own. */
function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function main(): void {
  const snapshot = parseSnapshot(readFileSync(inputPath(process.argv.slice(2)), 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`the board is not one the gate will take: ${issue}`);

  const out = outputDir();
  mkdirSync(out, { recursive: true });
  copyTree(join(ROOT, 'dashboard'), join(out, 'dashboard'));
  copyTree(join(ROOT, 'screenshots'), join(out, 'screenshots'));
  writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`, 'utf8');
  writeFileSync(join(out, 'data.js'), dataScript(radar), 'utf8');
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: 65536 }));

  const early = board.filter((row) => !snapshot.watchlist.includes(row.slug)).length;
  const live = radar.live.length;
  console.log(
    `${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
      `${board.length} rows scored (${early} early, ${live} live set aside)`,
  );
}

main();
