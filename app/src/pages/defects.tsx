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
import type { Defect, DefectInput, DefectSeverity, DefectStatus } from "@/types/qa"

type DefectForm = Omit<DefectInput, "caseId">
const blankDefect: DefectForm = {
  name: "",
  executionId: "",
  severity: 2,
  status: 1,
  description: "",
}
const executionStatusLabels: Record<number, string> = {
  1: "未実施",
  2: "成功",
  3: "失敗",
  4: "ブロック",
}
const severityLabels: Record<DefectSeverity, string> = { 1: "低", 2: "中", 3: "高", 4: "重大" }
const statusLabels: Record<DefectStatus, string> = { 1: "新規", 2: "対応中", 3: "解決", 4: "クローズ" }

function parseSeverity(value: string): DefectSeverity {
  switch (Number(value)) {
    case 1: return 1
    case 3: return 3
    case 4: return 4
    default: return 2
  }
}

function parseStatus(value: string): DefectStatus {
  switch (Number(value)) {
    case 2: return 2
    case 3: return 3
    case 4: return 4
    default: return 1
  }
}

export default function DefectsPage() {
  const queryClient = useQueryClient()
  const cases = useQuery({ queryKey: ["test-cases"], queryFn: QaService.listTestCases })
  const executions = useQuery({ queryKey: ["executions"], queryFn: QaService.listExecutions })
  const defects = useQuery({ queryKey: ["defects"], queryFn: QaService.listDefects })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Defect | null>(null)
  const [deleting, setDeleting] = useState<Defect | null>(null)
  const [form, setForm] = useState<DefectForm>(blankDefect)

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: DefectInput }) =>
      id ? QaService.updateDefect(id, input) : QaService.createDefect(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["defects"] })
      setDialogOpen(false)
      toast.success(editing ? "不具合を更新しました" : "不具合を登録しました")
    },
    onError: (error) => toast.error(`保存できませんでした: ${error.message}`),
  })
  const remove = useMutation({
    mutationFn: QaService.deleteDefect,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["defects"] })
      setDeleting(null)
      toast.success("不具合を削除しました")
    },
    onError: (error) => toast.error(`削除できませんでした: ${error.message}`),
  })

  const startCreate = () => {
    setEditing(null)
    setForm({ ...blankDefect, executionId: executions.data?.[0]?.id ?? "" })
    setDialogOpen(true)
  }
  const startEdit = (item: Defect) => {
    setEditing(item)
    setForm({
      name: item.name,
      executionId: item.executionId,
      severity: item.severity,
      status: item.status,
      description: item.description,
    })
    setDialogOpen(true)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const execution = executions.data?.find((item) => item.id === form.executionId)
    if (!execution) {
      toast.error("関連するテスト実行を選択してください。")
      return
    }
    save.mutate({
      id: editing?.id ?? null,
      input: { ...form, caseId: execution.caseId, name: form.name.trim() },
    })
  }

  const error = cases.error ?? executions.error ?? defects.error
  const loading = cases.isLoading || executions.isLoading || defects.isLoading
  if (loading || error) {
    return (
      <QueryState
        loading={loading}
        error={error}
        onRetry={() => { void Promise.all([cases.refetch(), executions.refetch(), defects.refetch()]) }}
      />
    )
  }

  const caseById = new Map((cases.data ?? []).map((item) => [item.id, item]))
  const executionById = new Map((executions.data ?? []).map((item) => [item.id, item]))
  const hasExecutions = (executions.data ?? []).length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="不具合"
        description="失敗したテスト実行に関連付けて不具合を追跡します。"
        action={
          <Button onClick={startCreate} disabled={!hasExecutions}>
            <Plus className="h-4 w-4" />不具合を登録
          </Button>
        }
      />
      {!hasExecutions && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          不具合を登録する前にテスト実行を記録してください。
        </p>
      )}
      <Card>
        <CardContent className="pt-6">
          {(defects.data ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">不具合はまだありません。</p>
          ) : (
            <TableShell>
              <TableHeader>
                <tr><TableHead>不具合</TableHead><TableHead>テストケース</TableHead><TableHead>実行</TableHead><TableHead>重要度</TableHead><TableHead>状態</TableHead><TableHead>操作</TableHead></tr>
              </TableHeader>
              <tbody>
                {defects.data?.map((item) => (
                  <tr key={item.id}>
                    <TableCell><div className="font-medium">{item.name}</div><div className="max-w-xs whitespace-pre-wrap text-muted-foreground">{item.description}</div></TableCell>
                    <TableCell>{caseById.get(item.caseId)?.caseKey ?? "削除済みケース"}</TableCell>
                    <TableCell>{executionById.get(item.executionId)?.name ?? "削除済み実行"}</TableCell>
                    <TableCell>{severityLabels[item.severity]}</TableCell>
                    <TableCell>{statusLabels[item.status]}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(item)} aria-label="不具合を編集"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleting(item)} aria-label="不具合を削除"><Trash2 className="h-4 w-4" /></Button>
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
        title={editing ? "不具合を編集" : "不具合を登録"}
        description="関連するテスト実行と不具合の内容を入力してください。"
        saving={save.isPending}
        onSubmit={submit}
      >
        <Field label="タイトル" required>
          <TextInput required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="ログイン時にエラーが発生する" />
        </Field>
        <Field label="関連するテスト実行" required>
          <SelectInput required value={form.executionId} onChange={(event) => setForm({ ...form, executionId: event.target.value })}>
            <option value="" disabled>選択してください</option>
            {executions.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {caseById.get(item.caseId)?.caseKey ?? "ケース"} / {item.name} ({executionStatusLabels[item.status]})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="重要度" required>
          <SelectInput value={form.severity} onChange={(event) => setForm({ ...form, severity: parseSeverity(event.target.value) })}>
            <option value={1}>低</option><option value={2}>中</option><option value={3}>高</option><option value={4}>重大</option>
          </SelectInput>
        </Field>
        <Field label="状態" required>
          <SelectInput value={form.status} onChange={(event) => setForm({ ...form, status: parseStatus(event.target.value) })}>
            <option value={1}>新規</option><option value={2}>対応中</option><option value={3}>解決</option><option value={4}>クローズ</option>
          </SelectInput>
        </Field>
        <Field label="詳細" required>
          <Textarea required className="min-h-32 sm:col-span-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
      </EditorDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="不具合を削除しますか？"
        description={`${deleting?.name ?? ""} を削除します。この操作は取り消せません。`}
        variant="destructive"
        confirmLabel={remove.isPending ? "削除中..." : "削除"}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id) }}
      />
    </div>
  )
}
