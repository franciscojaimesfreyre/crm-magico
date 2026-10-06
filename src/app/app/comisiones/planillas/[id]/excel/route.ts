import { requireUser } from "@/lib/auth";
import { buildStatementWorkbook, loadStatement, statementFilename } from "@/lib/commissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const statement = await loadStatement(id, user.organizationId);
  if (!statement) return new Response("No encontrada", { status: 404 });
  const buffer = await buildStatementWorkbook(statement);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${statementFilename(statement, "xlsx")}"`,
    },
  });
}
