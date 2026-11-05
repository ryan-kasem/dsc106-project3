const SCENARIOS = {
  historical: { label: "Historical", color: "var(--historical)" },
  ssp126: { label: "SSP1-2.6 (low)", color: "var(--ssp126)" },
  ssp585: { label: "SSP5-8.5 (high)", color: "var(--ssp585)" },
};
const PROJECTION_START = 2015;

const width = 900;
const height = 480;
const margin = { top: 36, right: 120, bottom: 44, left: 56 };

const fmt = d3.format("+.2f");
const fmtAbs = d3.format(".1f");

d3.csv("data/global_temp.csv", d3.autoType).then(render);

function render(rows) {
  const byScenario = d3.group(rows, (d) => d.scenario);
  const historical = byScenario.get("historical");
  const lastHist = historical[historical.length - 1];

  // Start each projection at the last historical year so the lines connect.
  const series = {
    historical,
    ssp126: [lastHist, ...byScenario.get("ssp126")],
    ssp585: [lastHist, ...byScenario.get("ssp585")],
  };
  const lookup = {};
  for (const [key, values] of Object.entries(series)) {
    lookup[key] = new Map(values.map((d) => [d.year, d]));
  }

  const x = d3.scaleLinear().domain([1850, 2100]).range([margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([Math.min(-0.5, d3.min(rows, (d) => d.anomaly)), d3.max(rows, (d) => d.anomaly) + 0.3])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", "Line chart of global temperature change from 1850 to 2100 under two emissions scenarios");

  // Shaded projection region
  svg
    .append("rect")
    .attr("class", "projected-bg")
    .attr("x", x(lastHist.year))
    .attr("y", margin.top)
    .attr("width", x(2100) - x(lastHist.year))
    .attr("height", height - margin.top - margin.bottom);

  svg
    .append("text")
    .attr("class", "region-label")
    .attr("x", x(1850) + 6)
    .attr("y", margin.top - 10)
    .text("Simulated past (1850–2014)");

  svg
    .append("text")
    .attr("class", "region-label")
    .attr("x", x(lastHist.year) + 6)
    .attr("y", margin.top - 10)
    .text("Projected (2015–2100)");

  // Gridlines + axes
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat(""));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(10));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat((d) => (d > 0 ? `+${d}` : d) + "°"));

  svg
    .append("text")
    .attr("class", "axis-title")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .text("Change from 1850–1900 average (°C)");

  // Paris Agreement reference lines
  for (const level of [1.5, 2]) {
    if (level > y.domain()[1]) continue;
    svg
      .append("line")
      .attr("class", "ref-line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(level))
      .attr("y2", y(level));
    svg
      .append("text")
      .attr("class", "ref-label")
      .attr("x", margin.left + 6)
      .attr("y", y(level) - 4)
      .text(`${level} °C — Paris Agreement ${level === 1.5 ? "goal" : "limit"}`);
  }

  // Lines
  const line = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.anomaly));

  const lines = svg
    .append("g")
    .selectAll("path")
    .data(Object.entries(series))
    .join("path")
    .attr("class", ([key]) => `line ${key}`)
    .attr("d", ([, values]) => line(values));

  // End-of-century labels
  const endLabels = svg
    .append("g")
    .selectAll("text")
    .data(["ssp126", "ssp585"])
    .join("text")
    .attr("class", (key) => `end-label ${key}`)
    .attr("x", x(2100) + 8)
    .attr("y", (key) => y(series[key].at(-1).anomaly))
    .attr("dy", "0.35em")
    .text((key) => `${key === "ssp126" ? "SSP1-2.6" : "SSP5-8.5"} ${fmt(series[key].at(-1).anomaly)}°`);

  // Hover layer
  const hover = svg.append("g").style("display", "none");
  hover
    .append("line")
    .attr("class", "hover-line")
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);
  const dots = hover
    .selectAll("circle")
    .data(Object.keys(series))
    .join("circle")
    .attr("class", "hover-dot")
    .attr("r", 4.5)
    .attr("fill", (key) => SCENARIOS[key].color);

  const tooltip = d3.select("#tooltip");
  let selected = "both";

  const isVisible = (key) =>
    key === "historical" || selected === "both" || selected === key;

  svg
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", "transparent")
    .on("pointerenter", () => {
      hover.style("display", null);
      tooltip.attr("hidden", null);
    })
    .on("pointerleave", () => {
      hover.style("display", "none");
      tooltip.attr("hidden", true);
    })
    .on("pointermove", (event) => {
      const [mx] = d3.pointer(event);
      const year = Math.max(1850, Math.min(2100, Math.round(x.invert(mx))));
      const isProjected = year >= PROJECTION_START;
      const keys = isProjected
        ? ["ssp126", "ssp585"].filter(isVisible)
        : ["historical"];

      hover.select(".hover-line").attr("x1", x(year)).attr("x2", x(year));
      dots
        .style("display", (key) => (keys.includes(key) && lookup[key].has(year) ? null : "none"))
        .attr("cx", x(year))
        .attr("cy", (key) => {
          const d = lookup[key].get(year);
          return d ? y(d.anomaly) : 0;
        });

      const rowsHtml = keys
        .filter((key) => lookup[key].has(year))
        .map((key) => {
          const d = lookup[key].get(year);
          return `<div class="row"><span><span class="swatch" style="background:${SCENARIOS[key].color}"></span>${SCENARIOS[key].label}</span><strong>${fmt(d.anomaly)} °C</strong></div>`;
        })
        .join("");

      let extra = "";
      if (isProjected && keys.length === 2) {
        const gap = lookup.ssp585.get(year).anomaly - lookup.ssp126.get(year).anomaly;
        extra = `<div class="tag">Gap between futures: ${fmtAbs(Math.abs(gap))} °C</div>`;
      } else if (keys.length === 1) {
        extra = `<div class="tag">Global average: ${fmtAbs(lookup[keys[0]].get(year).tas)} °C</div>`;
      }

      tooltip.html(
        `<div class="year">${year}${isProjected ? " · projected" : ""}</div>${rowsHtml}${extra}`
      );
      positionTooltip(event);
    });

  function positionTooltip(event) {
    const node = tooltip.node();
    const pad = 14;
    let left = event.clientX + pad;
    if (left + node.offsetWidth > window.innerWidth - 8) {
      left = event.clientX - node.offsetWidth - pad;
    }
    node.style.left = `${left}px`;
    node.style.top = `${event.clientY + pad}px`;
  }

  // Scenario selector
  const buttons = d3.selectAll(".controls button");
  buttons.on("click", function () {
    selected = this.dataset.scenario;
    buttons.classed("active", false);
    d3.select(this).classed("active", true);
    lines.classed("dimmed", ([key]) => !isVisible(key));
    endLabels.classed("dimmed", (key) => !isVisible(key));
  });
}
