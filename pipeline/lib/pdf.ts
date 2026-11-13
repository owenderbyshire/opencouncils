/**
 * Text from a PDF, laid out as on the page, using poppler's `pdftotext`
 * (installed on the pipeline's runners; `apt-get install poppler-utils`).
 */
import { spawn } from "node:child_process";

export function pdfText(bytes: Uint8Array, opts: { layout?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    // Layout keeps table columns apart; without it, two-column prose reads in order.
    const p = spawn("pdftotext", [...(opts.layout === false ? [] : ["-layout"]), "-enc", "UTF-8", "-", "-"]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => err.push(d));
    p.on("error", (e) =>
      reject(new Error(`pdftotext unavailable: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(out).toString("utf8"))
        : reject(
            new Error(
              `pdftotext exited ${code}: ${Buffer.concat(err).toString().slice(0, 200)}`,
            ),
          ),
    );
    p.stdin.end(Buffer.from(bytes));
  });
}
