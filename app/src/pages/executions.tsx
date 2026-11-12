import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  EditorDialog,
  Field,
  PageHeader,
  QueryState,
  SelectInput,
  TableCell,
  TableHead,
  TableHeader,
  TableShell,
  TextInput,
} from "@/components/qa-ui"
import { Textarea } from "@/components/ui/textarea"
import { QaService } from "@/lib/qa-service"
import type { ExecutionStatus, TestExecution, TestExecutionInput } from "@/types/qa"

const blankExecution: TestExecutionInput = {
  name: "",
  caseId: "",
  build: "",
  environment: "",
  status: 1,
  executedOn: new Date().toISOString().slice(0, 10),
  actualResult: "",
  notes: "",
}
const statusLabels: Record<ExecutionStatus, string> = {
  1: "未実施",
  2: "成功",
  3: "失敗",
  4: "ブロック",
}

function parseStatus(value: string): ExecutionStatus {
  switch (Number(value)) {
    case 2: return 2
    case 3: return 3
    case 4: return 4
    default: return 1
  }
}

export default function ExecutionsPage() {
  const queryClient = useQueryClient()
  const cases = useQuery({ queryKey: ["test-cases"], queryFn: QaService.listTestCases })
  const executions = useQuery({ queryKey: ["executions"], queryFn: QaService.listExecutions })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TestExecution | null>(null)
  const [deleting, setDeleting] = useState<TestExecution | null>(null)
  const [form, setForm] = useState<TestExecutionInput>(blankExecution)

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: TestExecutionInput }) =>
      id ? QaService.updateExecution(id, input) : QaService.createExecution(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["executions"] })
      await queryClient.invalidateQueries({ queryKey: ["defects"] })
      setDialogOpen(false)
      toast.success(editing ? "テスト実行を更新しました" : "テスト実行を記録しました")
    },
    onError: (error) => toast.error(`保存できませんでした: ${error.message}`),
  })
  const remove = useMutation({
    mutationFn: QaService.deleteExecution,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["executions"] })
      setDeleting(null)
      toast.success("テスト実行を削除しました")
    },
    onError: (error) => toast.error(`削除できませんでした: ${error.message}`),
  })

  const startCreate = () => {
    setEditing(null)
    setForm({ ...blankExecution, caseId: cases.data?.[0]?.id ?? "" })
    setDialogOpen(true)
  }
  const startEdit = (item: TestExecution) => {
    setEditing(item)
    setForm({
      name: item.name,
      caseId: item.caseId,
      build: item.build,
      environment: item.environment,
      status: item.status,
      executedOn: item.executedOn.slice(0, 10),
      actualResult: item.actualResult,
      notes: item.notes,
    })
    setDialogOpen(true)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedCase = cases.data?.find((item) => item.id === form.caseId)
    if (!selectedCase) {
      toast.error("テストケースを選択してください。")
      return
    }
    const date = form.executedOn || new Date().toISOString().slice(0, 10)
    save.mutate({
      id: editing?.id ?? null,
      input: { ...form, name: `${selectedCase.caseKey} - ${date}` },
    })
  }

  const error = cases.error ?? executions.error
  const loading = cases.isLoading || executions.isLoading
  if (loading || error) {
    return (
      <QueryState
        loading={loading}
        error={error}
        onRetry={() => { void Promise.all([cases.refetch(), executions.refetch()]) }}
      />
    )
  }

  const caseById = new Map((cases.data ?? []).map((item) => [item.id, item]))
  const hasCases = (cases.data ?? []).length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="テスト実行"
        description="実行環境、ビルド、結果を記録します。"
        action={
          <Button onClick={startCreate} disabled={!hasCases}>
            <Plus className="h-4 w-4" />実行を記録
          </Button>
        }
      />
      {!hasCases && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          実行を記録する前にテストケースを作成してください。
        </p>
      )}
      <Card>
        <CardContent className="pt-6">
          {(executions.data ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">テスト実行はまだありません。</p>
          ) : (
            <TableShell>
              <TableHeader>
                <tr><TableHead>テストケース</TableHead><TableHead>ビルド</TableHead><TableHead>環境</TableHead><TableHead>結果</TableHead><TableHead>実行日</TableHead><TableHead>操作</TableHead></tr>
              </TableHeader>
              <tbody>
                {executions.data?.map((item) => (
                  <tr key={item.id}>
                    <TableCell>{caseById.get(item.caseId)?.name ?? "削除済みケース"}</TableCell>
                    <TableCell>{item.build || "—"}</TableCell>
                    <TableCell>{item.environment || "—"}</TableCell>
                    <TableCell>{statusLabels[item.status]}</TableCell>
                    <TableCell>{item.executedOn ? new Date(item.executedOn).toLocaleDateString("ja-JP") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(item)} aria-label="実行を編集"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleting(item)} aria-label="実行を削除"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <EditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "テスト実行を編集" : "テスト実行を記録"}
        description="実行対象と結果を入力してください。"
        saving={save.isPending}
        onSubmit={submit}
      >
        <Field label="テストケース" required>
          <SelectInput required value={form.caseId} onChange={(event) => setForm({ ...form, caseId: event.target.value })}>
            <option value="" disabled>選択してください</option>
            {cases.data?.map((item) => <option key={item.id} value={item.id}>{item.caseKey} - {item.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="結果" required>
          <SelectInput value={form.status} onChange={(event) => setForm({ ...form, status: parseStatus(event.target.value) })}>
            <option value={1}>未実施</option><option value={2}>成功</option><option value={3}>失敗</option><option value={4}>ブロック</option>
          </SelectInput>
        </Field>
        <Field label="ビルド">
          <TextInput maxLength={100} value={form.build} onChange={(event) => setForm({ ...form, build: event.target.value })} placeholder="1.0.0" />
        </Field>
        <Field label="環境">
          <TextInput maxLength={100} value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value })} placeholder="Developer" />
        </Field>
        <Field label="実行日" required>
          <TextInput type="date" required value={form.executedOn.slice(0, 10)} onChange={(event) => setForm({ ...form, executedOn: event.target.value })} />
        </Field>
        <Field label="実際の結果">
          <Textarea className="min-h-24" value={form.actualResult} onChange={(event) => setForm({ ...form, actualResult: event.target.value })} />
        </Field>
        <Field label="メモ">
          <Textarea className="min-h-24 sm:col-span-2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Field>
      </EditorDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="テスト実行を削除しますか？"
        description="この実行記録を削除します。関連する不具合がある場合はDataverseが削除を拒否することがあります。"
        variant="destructive"
        confirmLabel={remove.isPending ? "削除中..." : "削除"}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id) }}
      />
    </div>
  )
}
