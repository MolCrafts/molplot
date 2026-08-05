import { describe, expect, it } from "@rstest/core";
import {
  scaleBar,
  takeAnnotations,
  type Annotation,
} from "../src/annotations";

describe("annotations", () => {
  it("scaleBar factory defaults to along when both ends are set", () => {
    const a = scaleBar({
      x: 0.18,
      y: 0.03,
      x2: 0.65,
      y2: 0.42,
      label: "ballistic",
    });
    expect(a.kind).toBe("scaleBar");
    expect(a.orientation).toBe("along");
    expect(a.offset).toBe(0.05);
    expect(a.capSize).toBe(8);
  });

  it("takeAnnotations strips the top-level key", () => {
    const { spec, annotations } = takeAnnotations({
      mark: "point",
      annotations: [
        { kind: "arrow", x: 0, y: 0, x2: 1, y2: 1 },
        { kind: "nope" },
      ],
    });
    expect(annotations).toHaveLength(1);
    expect((annotations[0] as Annotation).kind).toBe("arrow");
    expect("annotations" in spec).toBe(false);
  });
});
