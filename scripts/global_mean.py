"""Build data/global_temp.csv: annual global-mean near-surface air temperature
from CMIP6 GFDL-ESM4 (r1i1p1f1, Amon tas) for historical, SSP1-2.6, SSP5-8.5.

Global mean uses cos(latitude) area weights. Anomaly is relative to the
model's own 1850-1900 mean (the IPCC "pre-industrial" baseline).
"""
import sys
import numpy as np
import pandas as pd
import xarray as xr

BASE = "gs://cmip6/CMIP6"
STORES = {
    "historical": f"{BASE}/CMIP/NOAA-GFDL/GFDL-ESM4/historical/r1i1p1f1/Amon/tas/gr1/v20190726/",
    "ssp126": f"{BASE}/ScenarioMIP/NOAA-GFDL/GFDL-ESM4/ssp126/r1i1p1f1/Amon/tas/gr1/v20180701/",
    "ssp585": f"{BASE}/ScenarioMIP/NOAA-GFDL/GFDL-ESM4/ssp585/r1i1p1f1/Amon/tas/gr1/v20180701/",
}


def annual_global_mean(url):
    ds = xr.open_zarr(url, consolidated=True, storage_options={"token": "anon"})
    weights = np.cos(np.deg2rad(ds.lat))
    monthly = ds.tas.weighted(weights).mean(("lat", "lon"))
    annual = monthly.groupby("time.year").mean().compute()
    return annual.to_series() - 273.15  # K -> °C


frames = []
for scenario, url in STORES.items():
    print("loading", scenario, flush=True)
    s = annual_global_mean(url)
    frames.append(pd.DataFrame({"year": s.index, "scenario": scenario, "tas": s.values}))

df = pd.concat(frames, ignore_index=True)
hist = df[df.scenario == "historical"]
baseline = hist[(hist.year >= 1850) & (hist.year <= 1900)].tas.mean()
df["anomaly"] = df.tas - baseline
df = df[df.year <= 2100]
df.round(3).to_csv(sys.argv[1], index=False)
print(f"baseline 1850-1900 = {baseline:.2f} °C; wrote {len(df)} rows")
