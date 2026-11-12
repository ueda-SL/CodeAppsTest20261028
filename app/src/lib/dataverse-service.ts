import { getContext } from "@microsoft/power-apps/app"
import { MicrosoftDataverseService } from "@/generated/services/MicrosoftDataverseService"

const PREFER = "return=representation"
const READ_PREFER = 'odata.include-annotations="*"'
const ACCEPT = "application/json"

export type DataverseRow = Record<string, unknown>

let cachedOrgUrl: string | undefined

async function getOrgUrl(): Promise<string> {
  if (cachedOrgUrl) return cachedOrgUrl
  const context = await getContext()
  const orgUrl = context.app.dataverseOrgUrl
  if (!orgUrl) throw new Error("Dataverse org URL を取得できません。")
  cachedOrgUrl = orgUrl
  return orgUrl
}

function unwrap<T>(result: { success?: boolean; data?: T; error?: { message?: string } }): T {
  if (result.success === false) {
    throw new Error(result.error?.message ?? "Unknown Dataverse connector error")
  }
  return result.data as T
}

export const DataverseService = {
  async ListRecords(entityName: string, select?: string[], filter?: string) {
    const org = await getOrgUrl()
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      org,
      entityName,
      READ_PREFER,
      ACCEPT,
      undefined,
      undefined,
      select?.join(","),
      filter,
    )
    const data = unwrap<{ value?: DataverseRow[] }>(result)
    if (!Array.isArray(data.value)) throw new Error("Dataverse connector returned an invalid record list.")
    return data.value
  },
  async CreateRecord(entityName: string, body: DataverseRow) {
    const org = await getOrgUrl()
    const result = await MicrosoftDataverseService.CreateRecordWithOrganization(
      PREFER,
      ACCEPT,
      org,
      entityName,
      body,
    )
    unwrap<void>(result)
  },
  async UpdateRecord(entityName: string, recordId: string, body: DataverseRow) {
    const org = await getOrgUrl()
    const result = await MicrosoftDataverseService.UpdateRecordWithOrganization(
      PREFER,
      ACCEPT,
      org,
      entityName,
      recordId,
      body,
    )
    unwrap<DataverseRow>(result)
  },
  async DeleteRecord(entityName: string, recordId: string) {
    const org = await getOrgUrl()
    const result = await MicrosoftDataverseService.DeleteRecordWithOrganization(org, entityName, recordId)
    unwrap<void>(result)
  },
}
