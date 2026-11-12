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
import type { Priority, TestCase, TestCaseInput } from "@/types/qa"

const blankCase: TestCaseInput = {
  name: "",
  caseKey: "",
  area: "",
  priority: 2,
  preconditions: "",
  steps: "",
  expectedResult: "",
  isActive: true,
}
const priorityLabels: Record<Priority, string> = { 1: "低", 2: "中", 3: "高" }

function parsePriority(value: string): Priority {
  switch (Number(value)) {
    case 1: return 1
    case 3: return 3
    default: return 2
  }
}

export default function TestCasesPage() {
  const queryClient = useQueryClient()
  const cases = useQuery({ queryKey: ["test-cases"], queryFn: QaService.listTestCases })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TestCase | null>(null)
  const [deleting, setDeleting] = useState<TestCase | null>(null)
  const [form, setForm] = useState<TestCaseInput>(blankCase)
  const [searchTerm, setSearchTerm] = useState("")

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: TestCaseInput }) =>
      id ? QaService.updateTestCase(id, input) : QaService.createTestCase(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["test-cases"] })
      setDialogOpen(false)
      toast.success(editing ? "テストケースを更新しました" : "テストケースを作成しました")
    },
    onError: (error) => toast.error(`保存できませんでした: ${error.message}`),
  })
  const remove = useMutation({
    mutationFn: QaService.deleteTestCase,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["test-cases"] })
      setDeleting(null)
      toast.success("テストケースを削除しました")
    },
    onError: (error) => toast.error(`削除できませんでした: ${error.message}`),
  })

  const startCreate = () => {
    setEditing(null)
    setForm(blankCase)
    setDialogOpen(true)
  }
  const startEdit = (item: TestCase) => {
    setEditing(item)
    setForm({
      name: item.name,
      caseKey: item.caseKey,
      area: item.area,
      priority: item.priority,
      preconditions: item.preconditions,
      steps: item.steps,
      expectedResult: item.expectedResult,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate({ id: editing?.id ?? null, input: { ...form, name: form.name.trim(), caseKey: form.caseKey.trim() } })
  }
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("ja-JP")
  const filteredCases = (cases.data ?? []).filter((item) =>
    [item.caseKey, item.name, item.area]
      .some((value) => value.toLocaleLowerCase("ja-JP").includes(normalizedSearch)),
  )

  if (cases.isLoading || cases.error) {
    return <QueryState loading={cases.isLoading} error={cases.error} onRetry={() => { void cases.refetch() }} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="テストケース"
        description="テスト対象、手順、期待結果を管理します。"
        action={<Button onClick={startCreate}><Plus className="h-4 w-4" />新規作成</Button>}
      />
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 max-w-md">
            <TextInput
              type="search"
              aria-label="テストケース検索"
              placeholder="キー・ケース名・領域で検索"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {(cases.data ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              テストケースはまだありません。「新規作成」から追加してください。
            </p>
          ) : filteredCases.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">検索条件に一致するケースはありません。</p>
          ) : (
            <TableShell>
              <TableHeader>
                <tr><TableHead>キー / ケース名</TableHead><TableHead>領域</TableHead><TableHead>優先度</TableHead><TableHead>状態</TableHead><TableHead>期待結果</TableHead><TableHead>操作</TableHead></tr>
              </TableHeader>
              <tbody>
                {filteredCases.map((item) => (
                  <tr key={item.id}>
                    <TableCell><div className="font-medium">{item.caseKey}</div><div className="text-muted-foreground">{item.name}</div></TableCell>
                    <TableCell>{item.area || "—"}</TableCell>
                    <TableCell>{priorityLabels[item.priority]}</TableCell>
                    <TableCell>{item.isActive ? "有効" : "無効"}</TableCell>
                    <TableCell className="max-w-sm whitespace-pre-wrap">{item.expectedResult || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(item)} aria-label={`${item.caseKey}を編集`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleting(item)} aria-label={`${item.caseKey}を削除`}><Trash2 className="h-4 w-4" /></Button>
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
        title={editing ? "テストケースを編集" : "テストケースを作成"}
        description="必須項目を入力し、保存してください。"
        saving={save.isPending}
        onSubmit={submit}
      >
        <Field label="ケースキー" required>
          <TextInput required maxLength={80} value={form.caseKey} onChange={(event) => setForm({ ...form, caseKey: event.target.value })} placeholder="TC-001" />
        </Field>
        <Field label="ケース名" required>
          <TextInput required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="ログインできること" />
        </Field>
        <Field label="領域">
          <TextInput maxLength={120} value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="認証" />
        </Field>
        <Field label="優先度">
          <SelectInput value={form.priority} onChange={(event) => setForm({ ...form, priority: parsePriority(event.target.value) })}>
            <option value={1}>低</option><option value={2}>中</option><option value={3}>高</option>
          </SelectInput>
        </Field>
        <Field label="状態">
          <SelectInput value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm({ ...form, isActive: event.target.value === "active" })}>
            <option value="active">有効</option><option value="inactive">無効</option>
          </SelectInput>
        </Field>
        <Field label="事前条件">
          <Textarea className="min-h-24" value={form.preconditions} onChange={(event) => setForm({ ...form, preconditions: event.target.value })} />
        </Field>
        <Field label="手順">
          <Textarea className="min-h-24" value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} />
        </Field>
        <Field label="期待結果">
          <Textarea className="min-h-24 sm:col-span-2" value={form.expectedResult} onChange={(event) => setForm({ ...form, expectedResult: event.target.value })} />
        </Field>
      </EditorDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="テストケースを削除しますか？"
        description={`${deleting?.caseKey ?? ""} を削除します。関連する実行記録がある場合はDataverseが削除を拒否することがあります。`}
        variant="destructive"
        confirmLabel={remove.isPending ? "削除中..." : "削除"}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id) }}
      />
    </div>
  )
}
