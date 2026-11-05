# How Hot Will It Get? Two Climate Futures, 1850–2100

DSC 106 Project 3 — interactive D3.js visualization of CMIP6 global temperature projections.

## Run locally

```bash
python3 -m http.server 8777
```

Then open http://localhost:8777.

## Data

`data/global_temp.csv` — one row per year per scenario:

| column | meaning |
|---|---|
| `year` | calendar year |
| `scenario` | `historical` (1850–2014), `ssp126`, `ssp585` (2015–2100) |
| `tas` | global-mean near-surface air temperature, °C |
| `anomaly` | `tas` minus the 1850–1900 historical mean, °C |

Built by `scripts/global_mean.py` from CMIP6 NOAA-GFDL GFDL-ESM4, member r1i1p1f1, monthly `tas`
(Google Cloud public bucket `gs://cmip6`). Monthly grids are area-weighted by cos(latitude),
averaged globally, then averaged into calendar years.

```bash
pip install xarray zarr gcsfs cftime pandas dask
python scripts/global_mean.py data/global_temp.csv
```
