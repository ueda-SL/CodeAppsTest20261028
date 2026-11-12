export type Priority = 1 | 2 | 3
export type ExecutionStatus = 1 | 2 | 3 | 4
export type DefectSeverity = 1 | 2 | 3 | 4
export type DefectStatus = 1 | 2 | 3 | 4

export interface TestCase {
  id: string
  name: string
  caseKey: string
  area: string
  priority: Priority
  preconditions: string
  steps: string
  expectedResult: string
  isActive: boolean
}

export type TestCaseInput = Omit<TestCase, "id">

export interface TestExecution {
  id: string
  name: string
  caseId: string
  build: string
  environment: string
  status: ExecutionStatus
  executedOn: string
  actualResult: string
  notes: string
}

export type TestExecutionInput = Omit<TestExecution, "id">

export interface Defect {
  id: string
  name: string
  caseId: string
  executionId: string
  severity: DefectSeverity
  status: DefectStatus
  description: string
}

export type DefectInput = Omit<Defect, "id">
