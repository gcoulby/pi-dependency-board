import JSZip from 'jszip';
import type {
  BoardConfig, BoardManifest, Card, CardId, CardType, Dependency, DependencyState, Sprint, Team, Viewport,
} from '../types';
import { EXTERNAL_LANE_ID } from '../types';
import { DEFAULT_CARD_TYPES, PROTECTED_CARD_TYPE_IDS } from '../board/defaults';
import { safeHex } from '../lib/cardTypeStyle';

const SUPPORTED_VERSION = 1;

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png':  return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif':  return 'image/gif';
    case 'webp': return 'image/webp';
    case 'pdf':  return 'application/pdf';
    default:     return 'application/octet-stream';
  }
}

export interface LoadedAsset {
  buffer: ArrayBuffer;
  mimeType: string;
}

export interface BoardData {
  manifest: BoardManifest;
  config: BoardConfig;
  cards: Card[];
  dependencies: Dependency[];
  viewport: Viewport;
  assets: Record<string, LoadedAsset>;  // key = assetId (filename under assets/)
}

const DEP_STATES: DependencyState[] = ['proposed', 'agreed', 'at-risk'];

/**
 * A damaged file should open, not crash. Reassign cards that point at a
 * missing team, sprint or type, drop dependencies that point at missing
 * cards, and renumber `order` within every cell.
 */
export function healBoard(
  rawConfig: Partial<BoardConfig>,
  rawCards: Card[],
  rawDeps: Dependency[],
): { config: BoardConfig; cards: Card[]; dependencies: Dependency[] } {
  const warn = (msg: string) => console.warn(`[piboard] ${msg}`);

  const teams: Team[] = (rawConfig.teams ?? [])
    .filter((t) => t && typeof t.id === 'string' && t.id !== EXTERNAL_LANE_ID)
    .map((t) => ({ id: t.id, name: String(t.name ?? 'Team'), colour: safeHex(t.colour, '#58a6ff') }));

  let sprints: Sprint[] = (rawConfig.sprints ?? []).filter((s) => s && typeof s.id === 'string');
  if (sprints.length === 0) {
    warn('board has no sprints; adding one');
    sprints = [{ id: 'sprint-1', name: 'Sprint 1' }];
  }

  let cardTypes: CardType[] = (rawConfig.cardTypes ?? [])
    .filter((t) => t && typeof t.id === 'string')
    .map((t) => ({ id: t.id, name: String(t.name ?? 'Type'), colour: safeHex(t.colour), icon: t.icon ?? 'Layers' }));
  if (cardTypes.length === 0) {
    warn('board has no card types; restoring defaults');
    cardTypes = DEFAULT_CARD_TYPES.map((t) => ({ ...t }));
  }

  // Requirement and Dependency are permanent: add them back to boards saved without them
  for (const def of DEFAULT_CARD_TYPES) {
    if (PROTECTED_CARD_TYPE_IDS.includes(def.id) && !cardTypes.some((t) => t.id === def.id)) cardTypes.push({ ...def });
  }

  const config: BoardConfig = {
    pi: { name: rawConfig.pi?.name ?? 'PI', startDate: rawConfig.pi?.startDate },
    teams,
    sprints,
    cardTypes,
    externalLane: { label: rawConfig.externalLane?.label ?? 'External dependencies' },
  };

  const teamIds = new Set(teams.map((t) => t.id));
  const sprintIds = new Set(sprints.map((s) => s.id));
  const typeIds = new Set(cardTypes.map((t) => t.id));
  const fallbackLane = teams[0]?.id ?? EXTERNAL_LANE_ID;

  const seen = new Set<CardId>();
  const cards: Card[] = [];
  for (const raw of rawCards) {
    if (!raw || typeof raw.id !== 'string' || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const card: Card = {
      ...raw,
      title: raw.title ?? 'Untitled',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      properties: raw.properties ?? {},
      hasContent: Boolean(raw.hasContent),
      order: typeof raw.order === 'number' ? raw.order : 0,
    };
    if (card.laneId !== EXTERNAL_LANE_ID && !teamIds.has(card.laneId)) {
      warn(`card ${card.id}: unknown laneId "${card.laneId}", moved to "${fallbackLane}"`);
      card.laneId = fallbackLane;
    }
    if (!sprintIds.has(card.sprintId)) {
      warn(`card ${card.id}: unknown sprintId "${card.sprintId}", moved to "${sprints[0].id}"`);
      card.sprintId = sprints[0].id;
    }
    if (!typeIds.has(card.typeId)) {
      warn(`card ${card.id}: unknown typeId "${card.typeId}", changed to "${cardTypes[0].id}"`);
      card.typeId = cardTypes[0].id;
    }
    // 'mid' came from an earlier three-slot design; fold it into the start slot
    if (card.slot !== 'end') card.slot = undefined;
    if (card.size !== undefined && card.size !== 's' && card.size !== 'm' && card.size !== 'l') card.size = undefined;
    if (card.owner !== undefined && !teamIds.has(card.owner)) {
      warn(`card ${card.id}: owner "${card.owner}" is not a team, cleared`);
      card.owner = undefined;
    }
    cards.push(card);
  }

  // Renumber order 0..n within each cell so ties never exist
  const cells = new Map<string, { card: Card; i: number }[]>();
  cards.forEach((card, i) => {
    const key = `${card.laneId}\u0000${card.sprintId}\u0000${card.slot ?? 'start'}`;
    const list = cells.get(key);
    if (list) list.push({ card, i });
    else cells.set(key, [{ card, i }]);
  });
  for (const list of cells.values()) {
    list.sort((a, b) => a.card.order - b.card.order || a.i - b.i);
    list.forEach(({ card }, n) => { card.order = n; });
  }

  const dependencies: Dependency[] = [];
  const pairs = new Set<string>();
  for (const d of rawDeps) {
    if (!d || !seen.has(d.from) || !seen.has(d.to)) {
      warn(`dependency ${d?.id}: references a missing card, dropped`);
      continue;
    }
    if (d.from === d.to) { warn(`dependency ${d.id}: self-link, dropped`); continue; }
    const pair = `${d.from}\u0000${d.to}`;
    if (pairs.has(pair)) { warn(`dependency ${d.id}: duplicate, dropped`); continue; }
    pairs.add(pair);
    dependencies.push({ ...d, state: DEP_STATES.includes(d.state) ? d.state : 'proposed' });
  }

  return { config, cards, dependencies };
}

export async function readBoard(file: File | Blob): Promise<BoardData> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('This is not a valid .piboard file (it is not a ZIP archive).');
  }

  const manifestRaw = await zip.file('manifest.json')?.async('string');
  if (!manifestRaw) throw new Error('Invalid .piboard: missing manifest.json');
  const manifest = JSON.parse(manifestRaw) as BoardManifest;
  if (manifest.format !== 'piboard') {
    throw new Error('This is not a PI Board file. Only .piboard files can be opened.');
  }
  if (typeof manifest.version === 'number' && manifest.version > SUPPORTED_VERSION) {
    throw new Error(`This board was saved by a newer version of PI Board (format version ${manifest.version}).`);
  }

  const boardRaw = await zip.file('board.json')?.async('string');
  const rawConfig = boardRaw ? (JSON.parse(boardRaw) as Partial<BoardConfig>) : {};

  const cardsRaw = await zip.file('cards.json')?.async('string');
  const parsed = cardsRaw ? (JSON.parse(cardsRaw) as { cards?: Card[]; dependencies?: Dependency[] }) : {};

  const { config, cards, dependencies } = healBoard(rawConfig, parsed.cards ?? [], parsed.dependencies ?? []);

  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  const viewRaw = await zip.file('view.json')?.async('string');
  if (viewRaw) {
    const v = (JSON.parse(viewRaw) as { viewport?: Viewport }).viewport;
    if (v && [v.x, v.y, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) viewport = v;
  }

  // Load all assets eagerly — attachments are usually small
  const assets: Record<string, LoadedAsset> = {};
  const assetEntries = Object.entries(zip.files).filter(
    ([path]) => path.startsWith('assets/') && !path.endsWith('/')
  );
  await Promise.all(
    assetEntries.map(async ([path, entry]) => {
      const filename = path.slice('assets/'.length);
      const ext = filename.split('.').pop() ?? '';
      const buffer = await entry.async('arraybuffer');
      assets[filename] = { buffer, mimeType: mimeFromExt(ext) };
    })
  );

  return { manifest, config, cards, dependencies, viewport, assets };
}

export async function loadCardContent(file: File | Blob, cardId: CardId): Promise<unknown> {
  const zip = await JSZip.loadAsync(file);
  const raw = await zip.file(`content/${cardId}.json`)?.async('string');
  return raw ? (JSON.parse(raw) as unknown) : null;
}
