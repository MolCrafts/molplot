# Web

A paper figure is static. A dashboard pane has to move: new points arrive,
someone clicks a trace, the page goes dark. That is the web package.

```sh
npm install @molcrafts/molplot
```

A line you can keep adding points to:

```ts
import { LineChart } from "@molcrafts/molplot";

const chart = new LineChart(el, {
  showLegend: true,
  xAxis: { label: "x" },
  yAxis: { label: "y" },
  series: [{ id: "a", label: "A", initialPoints: [{ x: 0, y: 1 }] }],
});
await chart.ready();
await chart.appendPoint("a", { x: 1, y: 2 });
```

Dark mode follows the page. Drag to pan; wheel an axis to zoom.

Scatter, bar, and Gantt follow the same rhythm: create, wait until ready,
update or listen for clicks. For a chart with no framework, register the
element and drop it in HTML:

```ts
import "@molcrafts/molplot/elements";
```

A playground that reloads from source: `npm run example:web`.

Names and options: [API](../api/typescript.md).
