import { describe, expect, it } from "vitest";
import { resolveSpareMakerDefault } from "../../../../client/src/pages/spares/spareMakerDefault";

const makers = [
  { makerName: "Wärtsilä", makerCode: "MKR-001" },
  { makerName: "MAN Energy", makerCode: "MKR-002" },
];

describe("resolveSpareMakerDefault", () => {
  it("uses the listed maker and code for the selected component", () => {
    expect(resolveSpareMakerDefault({ maker: " wärtsilä " }, makers))
      .toEqual({ maker: "Wärtsilä", makerCode: "MKR-001" });
    expect(resolveSpareMakerDefault({ maker: "Other", makerCode: "mkr-002" }, makers))
      .toEqual({ maker: "MAN Energy", makerCode: "MKR-002" });
  });

  it("leaves the field blank for a missing or unlisted component maker", () => {
    expect(resolveSpareMakerDefault({ maker: "Unknown" }, makers))
      .toEqual({ maker: "", makerCode: "" });
    expect(resolveSpareMakerDefault({ maker: null }, makers))
      .toEqual({ maker: "", makerCode: "" });
    expect(resolveSpareMakerDefault({ maker: "Wärtsilä" }, []))
      .toEqual({ maker: "", makerCode: "" });
  });
});