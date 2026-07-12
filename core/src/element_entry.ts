// Browser bundle entry (see the `elements` lib in rslib.config.ts): loading
// this artifact registers the `<molplot-chart>` custom element as a side effect,
// so a docs page only needs a single <script>. Kept out of the main library
// entry (index.ts) so importing `@molcrafts/molplot` never auto-registers.
import { defineMolplotChart } from "./element";

defineMolplotChart();
