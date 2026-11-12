import type { ComponentProps, FormEvent, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function Field({
  label,
  children,
  required = false,
}: {
  label: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}{required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </Label>
      {children}
    </div>
  )
}

export function TextInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} />
}

export function SelectInput(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 ${props.className ?? ""}`}
    />
  )
}

export function QueryState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean
  error: Error | null
  onRetry: () => void
}) {
  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">読み込み中...</p>
  }
  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center" role="alert">
        <p className="font-medium">Dataverseのデータを読み込めませんでした。</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button type="button" variant="outline" onClick={onRetry}>再試行</Button>
      </div>
    )
  }
  return null
}

export function EditorDialog({
  open,
  onOpenChange,
  title,
  description,
  saving,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  saving: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">{children}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">{children}</table>
    </div>
  )
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="bg-muted/50 text-left text-muted-foreground">{children}</thead>
}

export function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-t px-4 py-3 align-top ${className}`}>{children}</td>
}

export function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>
}
