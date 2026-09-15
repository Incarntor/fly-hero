/** Загрузка данных, подготовленных pipeline/build.py (см. public/data/manifest.json). */

export interface LifParams {
  v_0: number;
  v_rst: number;
  v_th: number;
  t_mbr: number;
  tau: number;
  t_rfc: number;
  t_dly: number;
  w_syn: number;
  r_poi: number;
  f_poi: number;
  dt: number;
}

type Dtype = 'float32' | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'int16';

interface FileSpec {
  path: string;
  dtype: Dtype;
  shape: number[];
  bytes: number;
  sha256: string;
}

export type GroupRole = 'sensor' | 'effector' | 'probe';

export interface GroupSpec {
  role: GroupRole;
  label?: string;
  note?: string;
  /** Индексы нейронов в полном мозге. */
  full: number[];
  /** Индексы тех же нейронов в игровом подграфе. */
  game: number[];
}

export interface Manifest {
  lif: LifParams;
  brain: { neurons: number };
  game: { neurons: number; edges: number; hops: number; min_syn: number };
  enums: { super_class: string[]; nt: string[]; side: string[] };
  files: Record<string, FileSpec>;
  groups: Record<string, GroupSpec>;
}

/** Связи подграфа в формате CSR: исходящие связи нейрона i — col/weight[rowPtr[i] .. rowPtr[i + 1]). */
export interface GameGraph {
  neurons: number;
  rowPtr: Uint32Array;
  col: Uint32Array;
  /** Число синапсов со знаком: + возбуждающий, − тормозящий. */
  weight: Int16Array;
  /** Индекс нейрона подграфа → индекс в полном мозге. */
  index: Uint32Array;
}

export type ReadFile = (path: string) => Promise<ArrayBuffer>;

const ARRAYS = {
  float32: Float32Array,
  uint8: Uint8Array,
  uint16: Uint16Array,
  uint32: Uint32Array,
  uint64: BigUint64Array,
  int16: Int16Array,
} as const;

type ArrayOf<D extends Dtype> = InstanceType<(typeof ARRAYS)[D]>;

export function fetchReader(baseUrl: string): ReadFile {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return async (path) => {
    const response = await fetch(new URL(path, new URL(base, location.href)));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.arrayBuffer();
  };
}

export async function loadManifest(read: ReadFile): Promise<Manifest> {
  const text = new TextDecoder().decode(await read('manifest.json'));
  return JSON.parse(text) as Manifest;
}

async function loadArray<D extends Dtype>(manifest: Manifest, read: ReadFile, key: string, dtype: D): Promise<ArrayOf<D>> {
  const spec = manifest.files[key];
  if (!spec) throw new Error(`В manifest.json нет файла ${key}`);
  if (spec.dtype !== dtype) throw new Error(`${key}: ожидался ${dtype}, в манифесте ${spec.dtype}`);
  const buffer = await read(spec.path);
  if (buffer.byteLength !== spec.bytes) {
    throw new Error(`${spec.path}: ${buffer.byteLength} байт вместо ${spec.bytes} — пересобери данные`);
  }
  return new ARRAYS[dtype](buffer) as ArrayOf<D>;
}

export async function loadGameGraph(manifest: Manifest, read: ReadFile): Promise<GameGraph> {
  const [rowPtr, col, weight, index] = await Promise.all([
    loadArray(manifest, read, 'game.row_ptr', 'uint32'),
    loadArray(manifest, read, 'game.col', 'uint32'),
    loadArray(manifest, read, 'game.weight', 'int16'),
    loadArray(manifest, read, 'game.index', 'uint32'),
  ]);
  return { neurons: index.length, rowPtr, col, weight, index };
}

/** Координаты сом всех нейронов мозга, мкм: [x0, y0, z0, x1, y1, z1, …]. */
export function loadBrainPositions(manifest: Manifest, read: ReadFile): Promise<Float32Array> {
  return loadArray(manifest, read, 'brain.position', 'float32');
}
