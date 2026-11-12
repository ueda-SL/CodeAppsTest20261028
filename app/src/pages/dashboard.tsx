import { Link } from "react-router-dom"
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Bug, CheckCircle2, ClipboardList, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QueryState, TableCell, TableHead, TableHeader, TableShell } from "@/components/qa-ui"
import { CODEAPPS_APP_NAME } from "@/config"
import { QaService } from "@/lib/qa-service"

const EXECUTION_LABELS: Record<number, string> = {
  1: "未実施",
  2: "成功",
  3: "失敗",
  4: "ブロック",
}

export default function Dashboard() {
  const cases = useQuery({ queryKey: ["test-cases"], queryFn: QaService.listTestCases })
  const executions = useQuery({ queryKey: ["executions"], queryFn: QaService.listExecutions })
  const defects = useQuery({ queryKey: ["defects"], queryFn: QaService.listDefects })
  const error = cases.error ?? executions.error ?? defects.error
  const loading = cases.isLoading || executions.isLoading || defects.isLoading

  if (loading || error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{CODEAPPS_APP_NAME}</h1>
          <p className="text-muted-foreground">テスト状況の概要</p>
        </div>
        <QueryState
          loading={loading}
          error={error}
          onRetry={() => {
            void Promise.all([cases.refetch(), executions.refetch(), defects.refetch()])
          }}
        />
      </div>
    )
  }

  const caseRows = cases.data ?? []
  const executionRows = executions.data ?? []
  const defectRows = defects.data ?? []
  const passed = executionRows.filter((item) => item.status === 2).length
  const failed = executionRows.filter((item) => item.status === 3).length
  const blocked = executionRows.filter((item) => item.status === 4).length
  const openDefects = defectRows.filter((item) => item.status < 3).length
  const passRate = executionRows.length ? Math.round((passed / executionRows.length) * 100) : 0
  const recent = [...executionRows]
    .sort((a, b) => b.executedOn.localeCompare(a.executedOn))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{CODEAPPS_APP_NAME}</h1>
          <p className="text-muted-foreground">テスト状況の概要</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/test-cases">テストケースを管理する<ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard title="テストケース" value={caseRows.length} icon={<ClipboardList className="h-5 w-5" />} />
        <SummaryCard title="テスト実行" value={executionRows.length} icon={<PlayCircle className="h-5 w-5" />} />
        <SummaryCard title="成功率" value={`${passRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <SummaryCard title="失敗" value={failed} icon={<Bug className="h-5 w-5" />} />
        <SummaryCard title="ブロック" value={blocked} icon={<PlayCircle className="h-5 w-5" />} />
        <SummaryCard title="未解決の不具合" value={openDefects} icon={<Bug className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近のテスト実行</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              まだテスト実行がありません。テストケースを作成して実行を記録してください。
            </p>
          ) : (
            <TableShell>
              <TableHeader>
                <tr>
                  <TableHead>テスト</TableHead>
                  <TableHead>ビルド</TableHead>
                  <TableHead>環境</TableHead>
                  <TableHead>結果</TableHead>
                  <TableHead>実行日</TableHead>
                </tr>
              </TableHeader>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id}>
                    <TableCell>{caseRows.find((testCase) => testCase.id === item.caseId)?.name ?? "不明なケース"}</TableCell>
                    <TableCell>{item.build || "—"}</TableCell>
                    <TableCell>{item.environment || "—"}</TableCell>
                    <TableCell>{EXECUTION_LABELS[item.status] ?? "不明"}</TableCell>
                    <TableCell>{item.executedOn ? new Date(item.executedOn).toLocaleDateString("ja-JP") : "—"}</TableCell>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, icon }: { title: string; value: string | number; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
