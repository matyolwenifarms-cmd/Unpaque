// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { strToU8, zipSync } from "fflate";

// pdfjs is a megabyte and is loaded on demand. Stubbed here so the portal can
// be driven without it: what is under test is the review, not the PDF parser.
vi.mock("@/lib/read-pdf.ts", () => ({ readPdf: async () => [] }));

const { UploadPortal } = await import("./UploadPortal.tsx");

/**
 * A real File, so the component's own arrayBuffer path is exercised.
 *
 * The bytes are copied into a fresh ArrayBuffer because `Uint8Array` is typed
 * over `ArrayBufferLike`, which includes `SharedArrayBuffer`, and `BlobPart`
 * does not accept one.
 */
function file(name: string, bytes: Uint8Array): File {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], name);
}

const textFile = (name: string, text: string) => file(name, strToU8(text));

async function upload(...files: File[]) {
  const onImport = vi.fn();
  render(<UploadPortal onImport={onImport} />);
  await userEvent.upload(screen.getByLabelText("Choose files"), files);
  await waitFor(() => expect(screen.queryByText("Reading them…")).not.toBeInTheDocument());
  return onImport;
}

describe("handing over a folder", () => {
  it("says what each file appears to be, and why", async () => {
    await upload(
      textFile("docket.txt", "SAPS CHARGE SHEET\nCAS 231/08/2024"),
      textFile("amy.txt", "I, the undersigned, do hereby state under oath:"),
    );
    expect(await screen.findByText("docket.txt")).toBeInTheDocument();
    expect(screen.getByText(/It names a docket or charge sheet/)).toBeInTheDocument();
    expect(screen.getByText(/It reads as a sworn statement/)).toBeInTheDocument();
  });

  it("opens a zip and lists what was inside it", async () => {
    const zip = zipSync({ "docket.txt": strToU8("CHARGE SHEET"), "amy.txt": strToU8("Q: Where?") });
    await upload(file("case.zip", zip));
    expect(await screen.findByText("docket.txt")).toBeInTheDocument();
    expect(screen.getAllByText(/from case\.zip/).length).toBeGreaterThan(0);
    expect(screen.queryByText("case.zip")).not.toBeInTheDocument();
  });

  // Nothing is imported until the person says so.
  it("imports nothing until it is confirmed", async () => {
    const onImport = await upload(textFile("a.txt", "Some text."));
    expect(onImport).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Import 1 file/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  // The officer can tell in two seconds what no pattern can.
  it("lets the person correct what it guessed", async () => {
    const onImport = await upload(textFile("thing.txt", "The meeting happened."));
    expect(screen.getByText(/This one is a guess/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("What thing.txt is"), "testimony");
    await userEvent.click(screen.getByRole("button", { name: /Import 1 file/ }));
    expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ kind: "testimony" })]);
  });

  // Importing both is how one source comes to look like two.
  it("unticks a duplicate and says why", async () => {
    const onImport = await upload(
      textFile("statement.txt", "I do hereby state under oath: I was there."),
      textFile("statement-copy.txt", "I do hereby state under oath: I was there."),
    );
    expect(await screen.findByText(/The same file as statement\.txt/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Import 1 file/ }));
    expect(onImport.mock.calls[0]![0]).toHaveLength(1);
    expect(onImport.mock.calls[0]![0][0].name).toBe("statement.txt");
  });

  // Either an export quirk or somebody hiding something.
  it("shows a name that disagrees with the bytes", async () => {
    await upload(file("docket.doc", strToU8("%PDF-1.4\n")));
    expect(await screen.findByText(/The name says doc but the file is pdf/)).toBeInTheDocument();
  });

  // Dropping them would quietly shrink the case to whatever was typed.
  it("keeps a file it could not read, marked", async () => {
    const onImport = await upload(file("scan.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1])));
    expect(await screen.findByText("no text")).toBeInTheDocument();
    expect(screen.getByText(/Nothing has read what is in it/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Import 1 file/ }));
    expect(onImport.mock.calls[0]![0][0].pageCount).toBe(0);
  });

  it("summarises before anybody reads a row", async () => {
    await upload(textFile("a.txt", "One."), textFile("b.txt", "Two."));
    expect(await screen.findByText("2 files, all readable.")).toBeInTheDocument();
  });

  // A page boundary is not recoverable from concatenated text.
  it("hands pages through separately, so a locator can name one", async () => {
    const onImport = await upload(textFile("printed.txt", "Page one.\fPage two."));
    await userEvent.click(screen.getByRole("button", { name: /Import 1 file/ }));
    expect(onImport.mock.calls[0]![0][0].pages).toEqual([
      { number: 1, body: "Page one." },
      { number: 2, body: "Page two." },
    ]);
  });
});
