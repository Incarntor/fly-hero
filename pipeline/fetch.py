"""Скачивает сырые данные FlyWire (v783) в data/raw.

Источники — публичные GitHub-репозитории, авторизация не нужна:
- philshiu/Drosophila_brain_model — список нейронов и связи в формате модели Shiu et al. 2024;
- flyconnectome/flywire_annotations — аннотации нейронов (Schlegel et al. 2024).
"""

import sys
import urllib.request
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

SHIU = "https://raw.githubusercontent.com/philshiu/Drosophila_brain_model/main"
ANNOT = "https://raw.githubusercontent.com/flyconnectome/flywire_annotations/main/supplemental_files"

# имя файла -> (url, ожидаемый размер в байтах)
FILES = {
    "Completeness_783.csv": (f"{SHIU}/Completeness_783.csv", 3_327_347),
    "Connectivity_783.parquet": (f"{SHIU}/Connectivity_783.parquet", 100_804_642),
    "Supplemental_file1_neuron_annotations.tsv": (
        f"{ANNOT}/Supplemental_file1_neuron_annotations.tsv",
        31_718_505,
    ),
    # эталонные спайки модели Shiu (стимуляция сахарных нейронов) — для проверки нашей симуляции
    "sugarR.parquet": (f"{SHIU}/results/example/sugarR.parquet", 948_526),
}


def download(name: str, url: str, size: int) -> None:
    dest = RAW_DIR / name
    if dest.exists() and dest.stat().st_size == size:
        print(f"  ✓ {name} (уже есть)")
        return

    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"  ↓ {name} ({size / 1e6:.1f} МБ)")
    with urllib.request.urlopen(url) as resp, tmp.open("wb") as out:
        done = 0
        while chunk := resp.read(1 << 20):
            out.write(chunk)
            done += len(chunk)
            print(f"\r    {done / size:6.1%}", end="", flush=True)
    print()

    if tmp.stat().st_size != size:
        tmp.unlink()
        sys.exit(f"Размер {name} не совпал с ожидаемым — файл в репозитории изменился?")
    tmp.rename(dest)


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Данные → {RAW_DIR}")
    for name, (url, size) in FILES.items():
        download(name, url, size)


if __name__ == "__main__":
    main()
