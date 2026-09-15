"""Собирает бинарные файлы мозга для браузера.

Вход:  data/raw (см. fetch.py) и io_groups.json.
Выход: public/data/
  manifest.json            — описание файлов, групп нейронов, параметры LIF-модели
  cell_types.json          — словарь типов нейронов (индекс → имя)
  brain/*.bin              — все нейроны: позиции и атрибуты (для 3D-панели)
  game/*.bin               — подграф «сенсоры → нисходящие нейроны» в формате CSR (для симуляции)

Все бинарники little-endian, без заголовков; тип и длина указаны в manifest.json.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data"
GROUPS_FILE = Path(__file__).resolve().parent / "io_groups.json"

# Координаты FlyWire — в вокселях 4×4×40 нм; переводим в микроны.
VOXEL_UM = np.array([0.004, 0.004, 0.040], dtype=np.float64)

UNREACHED = np.iinfo(np.uint8).max

# Параметры модели Shiu et al. 2024 (model.py, default_params), в единицах мВ / мс / Гц.
LIF_PARAMS = {
    "v_0": -52.0,
    "v_rst": -52.0,
    "v_th": -45.0,
    "t_mbr": 20.0,
    "tau": 5.0,
    "t_rfc": 2.2,
    "t_dly": 1.8,
    "w_syn": 0.275,
    "r_poi": 150.0,
    "f_poi": 250,
    "dt": 0.1,
}


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    comp = pd.read_csv(RAW / "Completeness_783.csv", index_col=0)
    con = pd.read_parquet(
        RAW / "Connectivity_783.parquet",
        columns=["Presynaptic_Index", "Postsynaptic_Index", "Excitatory x Connectivity"],
    )
    annot = pd.read_csv(
        RAW / "Supplemental_file1_neuron_annotations.tsv", sep="\t", low_memory=False
    ).drop_duplicates("root_id").set_index("root_id")

    # Индексы в Connectivity — это номера строк Completeness; проверяем на всякий случай.
    check = pd.read_parquet(RAW / "Connectivity_783.parquet", columns=["Presynaptic_ID", "Presynaptic_Index"])
    sample = check.sample(10_000, random_state=0)
    assert (comp.index.values[sample.Presynaptic_Index.values] == sample.Presynaptic_ID.values).all()

    neurons = annot.reindex(comp.index)
    missing = neurons.super_class.isna().sum()
    if missing:
        print(f"  ! {missing} нейронов без аннотаций — позиция (0,0,0), класс unknown")
    return neurons, con


def categorical(series: pd.Series, dtype) -> tuple[np.ndarray, list[str]]:
    cat = series.fillna("unknown").astype("category")
    names = list(cat.cat.categories)
    assert len(names) <= np.iinfo(dtype).max
    return cat.cat.codes.to_numpy().astype(dtype), names


def resolve_group(spec: dict, neurons: pd.DataFrame) -> np.ndarray:
    mask = np.ones(len(neurons), dtype=bool)
    for col, value in spec.get("select", {}).items():
        values = value if isinstance(value, list) else [value]
        mask &= neurons[col].isin(values).to_numpy()
    if "root_ids" in spec:
        mask &= neurons.index.isin(spec["root_ids"])
    return np.flatnonzero(mask).astype(np.uint32)


def hop_distances(src: np.ndarray, dst: np.ndarray, n: int, seeds: np.ndarray, max_hops: int, min_syn: int, weight: np.ndarray) -> np.ndarray:
    """BFS по графу: минимальное число синаптических шагов от seeds (только по связям ≥ min_syn синапсов)."""
    strong = np.abs(weight) >= min_syn
    src, dst = src[strong], dst[strong]

    dist = np.full(n, UNREACHED, dtype=np.uint8)
    dist[seeds] = 0
    frontier = np.zeros(n, dtype=bool)
    frontier[seeds] = True
    for hop in range(1, max_hops + 1):
        new = np.zeros(n, dtype=bool)
        new[dst[frontier[src]]] = True
        new &= dist == UNREACHED
        if not new.any():
            break
        dist[new] = hop
        frontier = new
    return dist


def write_bin(path: Path, array: np.ndarray) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = np.ascontiguousarray(array).astype(array.dtype.newbyteorder("<"), copy=False).tobytes()
    path.write_bytes(data)
    return {
        "path": str(path.relative_to(OUT)),
        "dtype": array.dtype.name,
        "shape": list(array.shape),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest()[:16],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hops", type=int, default=4, help="макс. длина пути сенсор → эффектор в синапсах (по умолчанию 4)")
    parser.add_argument("--min-syn", type=int, default=5, help="мин. число синапсов в связи, чтобы по ней строить путь (по умолчанию 5)")
    args = parser.parse_args()

    print("Загрузка данных…")
    neurons, con = load()
    n = len(neurons)
    pre = con["Presynaptic_Index"].to_numpy(np.uint32)
    post = con["Postsynaptic_Index"].to_numpy(np.uint32)
    weight = con["Excitatory x Connectivity"].to_numpy()
    assert np.abs(weight).max() <= np.iinfo(np.int16).max
    weight = weight.astype(np.int16)
    print(f"  {n:,} нейронов, {len(pre):,} связей, {np.abs(weight.astype(np.int64)).sum():,} синапсов")

    files = {}

    # --- весь мозг: позиции и атрибуты ---
    soma = neurons[["soma_x", "soma_y", "soma_z"]].to_numpy(np.float64)
    pos = neurons[["pos_x", "pos_y", "pos_z"]].to_numpy(np.float64)
    xyz = np.where(np.isnan(soma), pos, soma)
    xyz = np.nan_to_num(xyz) * VOXEL_UM
    files["brain.position"] = write_bin(OUT / "brain" / "position.f32.bin", xyz.astype(np.float32))

    super_class, super_class_names = categorical(neurons.super_class, np.uint8)
    nt, nt_names = categorical(neurons.top_nt, np.uint8)
    side, side_names = categorical(neurons.side, np.uint8)
    cell_type, cell_type_names = categorical(neurons.cell_type, np.uint16)
    files["brain.super_class"] = write_bin(OUT / "brain" / "super_class.u8.bin", super_class)
    files["brain.nt"] = write_bin(OUT / "brain" / "nt.u8.bin", nt)
    files["brain.side"] = write_bin(OUT / "brain" / "side.u8.bin", side)
    files["brain.cell_type"] = write_bin(OUT / "brain" / "cell_type.u16.bin", cell_type)
    files["brain.root_id"] = write_bin(OUT / "brain" / "root_id.u64.bin", neurons.index.to_numpy(np.uint64))
    (OUT / "cell_types.json").write_text(json.dumps(cell_type_names, ensure_ascii=False))

    # --- группы ---
    config = json.loads(GROUPS_FILE.read_text())
    groups = {}
    for role in ("sensors", "effectors", "probes"):
        for name, spec in config[role].items():
            idx = resolve_group(spec, neurons)
            if len(idx) == 0:
                raise SystemExit(f"Группа {name} пустая — проверь фильтр в io_groups.json")
            groups[name] = {"role": role[:-1], **{k: v for k, v in spec.items() if k in ("label", "note")}, "full": idx}

    sensors = np.unique(np.concatenate([g["full"] for g in groups.values() if g["role"] == "sensor"]))
    effectors = np.unique(np.concatenate([g["full"] for g in groups.values() if g["role"] == "effector"]))

    # --- подграф для игры: нейроны на коротких путях сенсор → эффектор ---
    print(f"Подграф: пути ≤ {args.hops} синапсов по связям ≥ {args.min_syn} синапсов…")
    d_fwd = hop_distances(pre, post, n, sensors, args.hops, args.min_syn, weight)
    d_bwd = hop_distances(post, pre, n, effectors, args.hops, args.min_syn, weight)
    on_path = d_fwd.astype(np.int32) + d_bwd.astype(np.int32) <= args.hops

    keep = on_path.copy()
    for g in groups.values():
        keep[g["full"]] = True  # все члены групп нужны игре, даже если путь не найден

    for name, g in groups.items():
        idx = g["full"]
        if g["role"] == "sensor":
            reach = (d_bwd[idx] <= args.hops).mean()
            print(f"  {name:14} {len(idx):4} нейр., доходят до эффекторов: {reach:.0%}")
        elif g["role"] == "effector":
            reach = (d_fwd[idx] <= args.hops).mean()
            print(f"  {name:14} {len(idx):4} нейр., получают вход от сенсоров: {reach:.0%}")

    game_index = np.flatnonzero(keep).astype(np.uint32)
    remap = np.full(n, -1, dtype=np.int64)
    remap[game_index] = np.arange(len(game_index))

    edge_keep = keep[pre] & keep[post]
    g_pre = remap[pre[edge_keep]]
    g_post = remap[post[edge_keep]].astype(np.uint32)
    g_w = weight[edge_keep]
    order = np.argsort(g_pre, kind="stable")
    g_pre, g_post, g_w = g_pre[order], g_post[order], g_w[order]
    row_ptr = np.zeros(len(game_index) + 1, dtype=np.uint32)
    np.cumsum(np.bincount(g_pre, minlength=len(game_index)), out=row_ptr[1:])

    files["game.index"] = write_bin(OUT / "game" / "index.u32.bin", game_index)
    files["game.row_ptr"] = write_bin(OUT / "game" / "row_ptr.u32.bin", row_ptr)
    files["game.col"] = write_bin(OUT / "game" / "col.u32.bin", g_post)
    files["game.weight"] = write_bin(OUT / "game" / "weight.i16.bin", g_w)

    for g in groups.values():
        g["game"] = remap[g["full"]].astype(int).tolist()
        g["full"] = g["full"].astype(int).tolist()

    manifest = {
        "source": {
            "connectome": "FlyWire v783 (Dorkenwald et al. 2024, Schlegel et al. 2024), CC-BY 4.0",
            "model": "Shiu et al. 2024, Nature — leaky integrate-and-fire",
        },
        "units": {"position": "µm", "weight": "число синапсов со знаком (+ возбуждающий, − тормозящий)", "lif": "мВ, мс, Гц"},
        "lif": LIF_PARAMS,
        "brain": {"neurons": n},
        "game": {
            "neurons": len(game_index),
            "edges": int(len(g_post)),
            "hops": args.hops,
            "min_syn": args.min_syn,
        },
        "enums": {"super_class": super_class_names, "nt": nt_names, "side": side_names},
        "files": files,
        "groups": groups,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

    total = sum(f["bytes"] for f in files.values())
    print(f"\nИгровой подграф: {len(game_index):,} нейронов ({len(game_index) / n:.1%}), {len(g_post):,} связей")
    print(f"Записано в {OUT}: {total / 1e6:.1f} МБ")
    for key, f in files.items():
        print(f"  {f['path']:28} {f['bytes'] / 1e6:7.2f} МБ")


if __name__ == "__main__":
    main()
