import { describe, expect, it } from "vitest";
import { parsePastedTable } from "./table-import";

describe("parsePastedTable", () => {
  it("parses quoted CSV values that contain commas", () => {
    const parsed = parsePastedTable('Name,Notes,Amount\n"Ada","Shipped, paid","$1,200"\n"Ben","Pending","340"');

    expect(parsed).toMatchObject({
      delimiter: ",",
      headers: ["Name", "Notes", "Amount"],
      hasHeader: true,
      rows: [
        ["Ada", "Shipped, paid", "$1,200"],
        ["Ben", "Pending", "340"],
      ],
    });
  });

  it("parses semicolon-delimited CSV exports", () => {
    const parsed = parsePastedTable("Name;Status;Amount\nAda;Done;1200\nBen;Pending;340");

    expect(parsed).toMatchObject({
      delimiter: ";",
      headers: ["Name", "Status", "Amount"],
      hasHeader: true,
      rows: [
        ["Ada", "Done", "1200"],
        ["Ben", "Pending", "340"],
      ],
    });
  });

  it("keeps comma text inside semicolon-delimited cells", () => {
    const parsed = parsePastedTable('Name;Notes;Amount\nAda;"Shipped, paid";1200\nBen;"Waiting, vendor";340');

    expect(parsed).toMatchObject({
      delimiter: ";",
      headers: ["Name", "Notes", "Amount"],
      rows: [
        ["Ada", "Shipped, paid", "1200"],
        ["Ben", "Waiting, vendor", "340"],
      ],
    });
  });

  it("strips BOM and Excel delimiter hint rows", () => {
    const parsed = parsePastedTable("\uFEFFsep=;\nName;Status\nAda;Done\nBen;Pending");

    expect(parsed).toMatchObject({
      delimiter: ";",
      headers: ["Name", "Status"],
      hasHeader: true,
      rows: [
        ["Ada", "Done"],
        ["Ben", "Pending"],
      ],
    });
  });

  it("keeps the first row when pasted text rows do not include headers", () => {
    const parsed = parsePastedTable("Ada,Done\nBen,Pending");

    expect(parsed).toMatchObject({
      delimiter: ",",
      headers: ["Column 1", "Column 2"],
      hasHeader: false,
      rows: [
        ["Ada", "Done"],
        ["Ben", "Pending"],
      ],
    });
  });

  it("parses newline-only single-column data", () => {
    const parsed = parsePastedTable("Ada\nBen\nCara");

    expect(parsed).toMatchObject({
      delimiter: "\n",
      headers: ["Column 1"],
      hasHeader: false,
      rows: [["Ada"], ["Ben"], ["Cara"]],
    });
  });

  it("detects a header in newline-only single-column data", () => {
    const parsed = parsePastedTable("Name\nAda\nBen");

    expect(parsed).toMatchObject({
      delimiter: "\n",
      headers: ["Name"],
      hasHeader: true,
      rows: [["Ada"], ["Ben"]],
    });
  });

  it("does not treat one copied cell as structured data", () => {
    expect(parsePastedTable("Ada")).toBeNull();
  });
});
