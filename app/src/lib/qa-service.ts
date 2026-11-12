import { PUBLISHER_PREFIX } from "@/config"
import { DataverseService, type DataverseRow } from "@/lib/dataverse-service"
import type {
  Defect,
  DefectInput,
  DefectSeverity,
  DefectStatus,
  ExecutionStatus,
  Priority,
  TestCase,
  TestCaseInput,
  TestExecution,
  TestExecutionInput,
} from "@/types/qa"

const PREFIX = PUBLISHER_PREFIX

function entitySet(value: string | undefined, key: string): string {
  const configured = value?.trim()
  if (!configured) throw new Error(`${key} is missing. Run scripts/setup_dataverse.py first.`)
  return configured
}

const CASES = entitySet(import.meta.env.VITE_TEST_CASE_ENTITY_SET, "VITE_TEST_CASE_ENTITY_SET")
const EXECUTIONS = entitySet(import.meta.env.VITE_TEST_EXECUTION_ENTITY_SET, "VITE_TEST_EXECUTION_ENTITY_SET")
const DEFECTS = entitySet(import.meta.env.VITE_DEFECT_ENTITY_SET, "VITE_DEFECT_ENTITY_SET")

function valueAsString(value: unknown): string {
  return value == null ? "" : String(value)
}

function valueAsBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true"
}

function valueAsChoice<T extends number>(value: unknown, allowed: readonly T[], fallback: T): T {
  const numeric = Number(value)
  return allowed.find((item) => item === numeric) ?? fallback
}

function caseFromRow(row: DataverseRow): TestCase {
  return {
    id: valueAsString(row[`${PREFIX}_testcaseid`]),
    name: valueAsString(row[`${PREFIX}_name`]),
    caseKey: valueAsString(row[`${PREFIX}_casekey`]),
    area: valueAsString(row[`${PREFIX}_area`]),
    priority: valueAsChoice<Priority>(row[`${PREFIX}_priority`], [1, 2, 3], 2),
    preconditions: valueAsString(row[`${PREFIX}_preconditions`]),
    steps: valueAsString(row[`${PREFIX}_steps`]),
    expectedResult: valueAsString(row[`${PREFIX}_expectedresult`]),
    isActive: valueAsBoolean(row[`${PREFIX}_isactive`]),
  }
}

function executionFromRow(row: DataverseRow): TestExecution {
  return {
    id: valueAsString(row[`${PREFIX}_testexecutionid`]),
    name: valueAsString(row[`${PREFIX}_name`]),
    caseId: valueAsString(row[`_${PREFIX}_testcaseid_value`]),
    build: valueAsString(row[`${PREFIX}_build`]),
    environment: valueAsString(row[`${PREFIX}_environment`]),
    status: valueAsChoice<ExecutionStatus>(row[`${PREFIX}_status`], [1, 2, 3, 4], 1),
    executedOn: valueAsString(row[`${PREFIX}_executedon`]),
    actualResult: valueAsString(row[`${PREFIX}_actualresult`]),
    notes: valueAsString(row[`${PREFIX}_notes`]),
  }
}

function defectFromRow(row: DataverseRow): Defect {
  return {
    id: valueAsString(row[`${PREFIX}_defectid`]),
    name: valueAsString(row[`${PREFIX}_name`]),
    caseId: valueAsString(row[`_${PREFIX}_testcaseid_value`]),
    executionId: valueAsString(row[`_${PREFIX}_testexecutionid_value`]),
    severity: valueAsChoice<DefectSeverity>(row[`${PREFIX}_severity`], [1, 2, 3, 4], 2),
    status: valueAsChoice<DefectStatus>(row[`${PREFIX}_status`], [1, 2, 3, 4], 1),
    description: valueAsString(row[`${PREFIX}_description`]),
  }
}

function caseBody(input: TestCaseInput): DataverseRow {
  return {
    [`${PREFIX}_name`]: input.name.trim(),
    [`${PREFIX}_casekey`]: input.caseKey.trim(),
    [`${PREFIX}_area`]: input.area.trim(),
    [`${PREFIX}_priority`]: input.priority,
    [`${PREFIX}_preconditions`]: input.preconditions.trim(),
    [`${PREFIX}_steps`]: input.steps.trim(),
    [`${PREFIX}_expectedresult`]: input.expectedResult.trim(),
    [`${PREFIX}_isactive`]: input.isActive,
  }
}

function executionBody(input: TestExecutionInput): DataverseRow {
  return {
    [`${PREFIX}_name`]: input.name.trim(),
    [`${PREFIX}_testcaseid@odata.bind`]: `/${CASES}(${input.caseId})`,
    [`${PREFIX}_build`]: input.build.trim(),
    [`${PREFIX}_environment`]: input.environment.trim(),
    [`${PREFIX}_status`]: input.status,
    [`${PREFIX}_executedon`]: input.executedOn ? new Date(input.executedOn).toISOString() : null,
    [`${PREFIX}_actualresult`]: input.actualResult.trim(),
    [`${PREFIX}_notes`]: input.notes.trim(),
  }
}

function defectBody(input: DefectInput): DataverseRow {
  return {
    [`${PREFIX}_name`]: input.name.trim(),
    [`${PREFIX}_testcaseid@odata.bind`]: `/${CASES}(${input.caseId})`,
    [`${PREFIX}_testexecutionid@odata.bind`]: `/${EXECUTIONS}(${input.executionId})`,
    [`${PREFIX}_severity`]: input.severity,
    [`${PREFIX}_status`]: input.status,
    [`${PREFIX}_description`]: input.description.trim(),
  }
}

export const QaService = {
  async listTestCases(): Promise<TestCase[]> {
    const rows = await DataverseService.ListRecords(CASES, [
      `${PREFIX}_testcaseid`, `${PREFIX}_name`, `${PREFIX}_casekey`, `${PREFIX}_area`,
      `${PREFIX}_priority`, `${PREFIX}_preconditions`, `${PREFIX}_steps`, `${PREFIX}_expectedresult`,
      `${PREFIX}_isactive`,
    ])
    return rows.map(caseFromRow).sort((a, b) => a.caseKey.localeCompare(b.caseKey))
  },
  createTestCase(input: TestCaseInput) {
    return DataverseService.CreateRecord(CASES, caseBody(input))
  },
  updateTestCase(id: string, input: TestCaseInput) {
    return DataverseService.UpdateRecord(CASES, id, caseBody(input))
  },
  deleteTestCase(id: string) {
    return DataverseService.DeleteRecord(CASES, id)
  },
  async listExecutions(): Promise<TestExecution[]> {
    const rows = await DataverseService.ListRecords(EXECUTIONS, [
      `${PREFIX}_testexecutionid`, `${PREFIX}_name`, `_${PREFIX}_testcaseid_value`,
      `${PREFIX}_build`, `${PREFIX}_environment`, `${PREFIX}_status`, `${PREFIX}_executedon`,
      `${PREFIX}_actualresult`, `${PREFIX}_notes`,
    ])
    return rows.map(executionFromRow)
  },
  createExecution(input: TestExecutionInput) {
    return DataverseService.CreateRecord(EXECUTIONS, executionBody(input))
  },
  updateExecution(id: string, input: TestExecutionInput) {
    return DataverseService.UpdateRecord(EXECUTIONS, id, executionBody(input))
  },
  deleteExecution(id: string) {
    return DataverseService.DeleteRecord(EXECUTIONS, id)
  },
  async listDefects(): Promise<Defect[]> {
    const rows = await DataverseService.ListRecords(DEFECTS, [
      `${PREFIX}_defectid`, `${PREFIX}_name`, `_${PREFIX}_testcaseid_value`,
      `_${PREFIX}_testexecutionid_value`, `${PREFIX}_severity`, `${PREFIX}_status`,
      `${PREFIX}_description`,
    ])
    return rows.map(defectFromRow)
  },
  createDefect(input: DefectInput) {
    return DataverseService.CreateRecord(DEFECTS, defectBody(input))
  },
  updateDefect(id: string, input: DefectInput) {
    return DataverseService.UpdateRecord(DEFECTS, id, defectBody(input))
  },
  deleteDefect(id: string) {
    return DataverseService.DeleteRecord(DEFECTS, id)
  },
}
