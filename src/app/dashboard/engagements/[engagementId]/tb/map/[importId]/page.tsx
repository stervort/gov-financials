export const dynamic = "force-dynamic";

import TBMapperClient from "./tb-mapper-client";
import { getImportForMapping, finalizeTBMapping } from "@/src/server/actions/tb";

type Params = { engagementId: string; importId: string };

export default async function TBMapPage({ params }: { params: Params }) {
  // ✅ Your action expects 1 arg (importId)
  const data: any = await getImportForMapping(params.importId);

  // Support either shape:
  // - data.matrix (array of rows)
  // - data.preview.matrix
  // - data.rows
  const matrix: any[][] =
    data?.matrix ??
    data?.preview?.matrix ??
    data?.rows ??
    [];

  const maxCols =
    data?.maxCols ??
    data?.preview?.maxCols ??
    Math.max(0, ...matrix.map((r) => (Array.isArray(r) ? r.length : 0)));

  // `imp` might be nested or top-level depending on how your action returns it
  const imp = data?.imp ?? data?.import ?? data ?? {};

  const hasHeaders = Boolean(imp?.hasHeaders ?? imp?.hasHeaderRows ?? false);
  const headerRowsToSkip = Number(imp?.headerRowsToSkip ?? imp?.headerRows ?? 0) || 0;

  // Existing mapping may be stored on the import, or returned separately
  const existingMapping =
    imp?.mapping ??
    data?.mapping ??
    {};

  const fileName: string | null = imp?.fileName ?? imp?.originalFileName ?? null;

  // Convert matrix -> preview rows with 1-based row numbers
  const previewRows = (matrix || []).map((row, idx) => ({
    rowNumber: idx + 1,
    cells: (Array.isArray(row) ? row : []).map((c) => (c == null ? "" : String(c))),
  }));

  async function actionFinalize(payload: {
    engagementId: string;
    importId: string;
    mapping: Record<string, any>;
    hasHeaders: boolean;
    headerRowsToSkip: number;
  }): Promise<{ ok: boolean; error?: string; redirectTo?: string }> {
    try {
      const fd = new FormData();
      fd.set("engagementId", payload.engagementId);
      fd.set("importId", payload.importId);
      fd.set("hasHeaders", payload.hasHeaders ? "true" : "false");
      fd.set("headerRowsToSkip", String(payload.headerRowsToSkip ?? 0));
      fd.set("mapping", JSON.stringify(payload.mapping ?? {}));

      await finalizeTBMapping(fd);

      return {
        ok: true,
        redirectTo: `/dashboard/engagements/${payload.engagementId}`,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Finalize failed" };
    }
  }

  return (
    <TBMapperClient
      engagementId={params.engagementId}
      importId={params.importId}
      fileName={fileName}
      hasHeaders={hasHeaders}
      headerRowsToSkip={headerRowsToSkip}
      preview={{
        maxCols,
        rows: previewRows,
      }}
      existingMapping={existingMapping}
      actionFinalize={actionFinalize}
    />
  );
}
