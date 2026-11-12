"""Provision the QA management solution and its Dataverse schema."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parent
load_dotenv(APP_ROOT / ".env", override=True)
sys.path.insert(0, str(REPO_ROOT / ".github" / "skills" / "standard" / "scripts"))

from auth_helper import api_get, api_post, retry_metadata  # noqa: E402

PREFIX = os.environ.get("PUBLISHER_PREFIX", "").strip()
SOLUTION_NAME = os.environ.get("SOLUTION_NAME", "").strip()
SOLUTION_DISPLAY_NAME = os.environ.get("SOLUTION_DISPLAY_NAME", "").strip()
TABLES = {
    f"{PREFIX}_testcase": {
        "display": "Test Case",
        "plural": "Test Cases",
        "columns": [
            ("casekey", "String", "Case Key", 80),
            ("area", "String", "Area", 120),
            ("priority", "Picklist", "Priority", [(1, "Low"), (2, "Medium"), (3, "High")]),
            ("preconditions", "Memo", "Preconditions", 4000),
            ("steps", "Memo", "Steps", 4000),
            ("expectedresult", "Memo", "Expected Result", 4000),
            ("isactive", "Boolean", "Active", None),
        ],
    },
    f"{PREFIX}_testexecution": {
        "display": "Test Execution",
        "plural": "Test Executions",
        "columns": [
            ("build", "String", "Build", 100),
            ("environment", "String", "Environment", 100),
            ("status", "Picklist", "Status", [(1, "Not Run"), (2, "Passed"), (3, "Failed"), (4, "Blocked")]),
            ("executedon", "DateTime", "Executed On", None),
            ("actualresult", "Memo", "Actual Result", 4000),
            ("notes", "Memo", "Notes", 4000),
        ],
    },
    f"{PREFIX}_defect": {
        "display": "Defect",
        "plural": "Defects",
        "columns": [
            ("severity", "Picklist", "Severity", [(1, "Low"), (2, "Medium"), (3, "High"), (4, "Critical")]),
            ("status", "Picklist", "Status", [(1, "New"), (2, "In Progress"), (3, "Resolved"), (4, "Closed")]),
            ("description", "Memo", "Description", 4000),
        ],
    },
}
LOOKUPS = [
    (f"{PREFIX}_testexecution", f"{PREFIX}_testcaseid", f"{PREFIX}_testcase", "Test Case"),
    (f"{PREFIX}_defect", f"{PREFIX}_testexecutionid", f"{PREFIX}_testexecution", "Test Execution"),
    (f"{PREFIX}_defect", f"{PREFIX}_testcaseid", f"{PREFIX}_testcase", "Test Case"),
]
ENTITY_SET_ENV = {
    f"{PREFIX}_testcase": "VITE_TEST_CASE_ENTITY_SET",
    f"{PREFIX}_testexecution": "VITE_TEST_EXECUTION_ENTITY_SET",
    f"{PREFIX}_defect": "VITE_DEFECT_ENTITY_SET",
}


def label(text: str) -> dict:
    return {"LocalizedLabels": [{"Label": text, "LanguageCode": 1033}]}


def validate_config() -> None:
    if not PREFIX or PREFIX.startswith("{") or not SOLUTION_NAME or SOLUTION_NAME.startswith("{"):
        raise ValueError("Set PUBLISHER_PREFIX and SOLUTION_NAME in the app .env before provisioning.")
    if not SOLUTION_DISPLAY_NAME or SOLUTION_DISPLAY_NAME.startswith("{"):
        raise ValueError("Set SOLUTION_DISPLAY_NAME in the app .env before provisioning.")
    if not SOLUTION_NAME.startswith(f"{PREFIX}_"):
        raise ValueError("SOLUTION_NAME must begin with the selected publisher prefix.")


def get_optional(path: str) -> dict | None:
    try:
        return api_get(path)
    except requests.HTTPError as error:
        if error.response is not None and error.response.status_code == 404:
            return None
        raise


def create_metadata(action, description: str):
    try:
        return retry_metadata(action, description)
    except requests.HTTPError as error:
        detail = error.response.text[:2000] if error.response is not None else str(error)
        raise RuntimeError(f"{description} failed: {detail}") from error


def save_env_values(values: dict[str, str]) -> None:
    env_path = APP_ROOT / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines()
    remaining = dict(values)
    output: list[str] = []
    for line in lines:
        key, separator, _ = line.partition("=")
        if separator and key in remaining:
            output.append(f"{key}={remaining.pop(key)}")
        else:
            output.append(line)
    output.extend(f"{key}={value}" for key, value in remaining.items())
    env_path.write_text("\n".join(output) + "\n", encoding="utf-8")

    root_env = REPO_ROOT / ".env"
    if root_env.exists():
        root_lines = root_env.read_text(encoding="utf-8").splitlines()
        root_remaining = dict(values)
        root_output: list[str] = []
        for line in root_lines:
            key, separator, _ = line.partition("=")
            if separator and key in root_remaining:
                root_output.append(f"{key}={root_remaining.pop(key)}")
            else:
                root_output.append(line)
        root_output.extend(f"{key}={value}" for key, value in root_remaining.items())
        root_env.write_text("\n".join(root_output) + "\n", encoding="utf-8")


def resolve_publisher_id() -> str:
    publishers = api_get(
        f"publishers?$filter=customizationprefix eq '{PREFIX}'"
        "&$select=publisherid,uniquename,friendlyname"
    ).get("value", [])
    if len(publishers) != 1:
        names = ", ".join(item.get("uniquename", "(unnamed)") for item in publishers) or "none"
        raise RuntimeError(
            f"Expected exactly one publisher with prefix '{PREFIX}', found {len(publishers)} ({names}). "
            "Set PUBLISHER_UNIQUE_NAME to disambiguate before continuing."
        )
    return publishers[0]["publisherid"]


def ensure_solution() -> str:
    publisher_id = resolve_publisher_id()
    solutions = api_get(
        f"solutions?$filter=uniquename eq '{SOLUTION_NAME}'"
        "&$select=solutionid,friendlyname,_publisherid_value"
    ).get("value", [])
    if len(solutions) > 1:
        raise RuntimeError(f"Multiple solutions use the unique name '{SOLUTION_NAME}'.")
    if solutions:
        solution = solutions[0]
        if solution.get("_publisherid_value", "").lower() != publisher_id.lower():
            raise RuntimeError("The existing solution uses a different publisher; refusing to modify it.")
        solution_id = solution["solutionid"]
        print(f"Using existing solution '{SOLUTION_NAME}'.")
    else:
        api_post(
            "solutions",
            {
                "uniquename": SOLUTION_NAME,
                "friendlyname": SOLUTION_DISPLAY_NAME,
                "version": "1.0.0.0",
                "publisherid@odata.bind": f"/publishers({publisher_id})",
            },
        )
        solution = api_get(
            f"solutions?$filter=uniquename eq '{SOLUTION_NAME}'&$select=solutionid"
        )["value"][0]
        solution_id = solution["solutionid"]
        print(f"Created solution '{SOLUTION_NAME}'.")

    save_env_values({"SOLUTION_ID": solution_id})
    return solution_id


def is_in_solution(metadata_id: str, solution_id: str) -> bool:
    components = api_get(
        "solutioncomponents?$select=objectid"
        f"&$filter=_solutionid_value eq {solution_id} and componenttype eq 1"
    ).get("value", [])
    return any(item.get("objectid", "").lower() == metadata_id.lower() for item in components)


def build_column(column: tuple) -> dict:
    suffix, kind, display, extra = column
    logical = f"{PREFIX}_{suffix}"
    body = {
        "SchemaName": logical,
        "DisplayName": label(display),
        "RequiredLevel": {"Value": "None"},
    }
    if kind == "String":
        body.update({
            "@odata.type": "#Microsoft.Dynamics.CRM.StringAttributeMetadata",
            "FormatName": {"Value": "Text"},
            "MaxLength": extra,
        })
    elif kind == "Memo":
        body.update({
            "@odata.type": "#Microsoft.Dynamics.CRM.MemoAttributeMetadata",
            "Format": "Text",
            "MaxLength": extra,
        })
    elif kind == "DateTime":
        body.update({
            "@odata.type": "#Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
            "Format": "DateAndTime",
        })
    elif kind == "Picklist":
        body.update({
            "@odata.type": "#Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
            "OptionSet": {
                "@odata.type": "#Microsoft.Dynamics.CRM.OptionSetMetadata",
                "IsGlobal": False,
                "OptionSetType": "Picklist",
                "Options": [{"Value": value, "Label": label(option)} for value, option in extra],
            },
        })
    elif kind == "Boolean":
        body.update({
            "@odata.type": "#Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
            "OptionSet": {
                "@odata.type": "#Microsoft.Dynamics.CRM.BooleanOptionSetMetadata",
                "TrueOption": {"Value": 1, "Label": label("Active")},
                "FalseOption": {"Value": 0, "Label": label("Inactive")},
            },
        })
    else:
        raise ValueError(f"Unsupported column type: {kind}")
    return body


def ensure_table(logical_name: str, definition: dict, solution_id: str) -> None:
    metadata = get_optional(
        f"EntityDefinitions(LogicalName='{logical_name}')?$select=MetadataId,EntitySetName"
    )
    if metadata is None:
        body = {
            "@odata.type": "#Microsoft.Dynamics.CRM.EntityMetadata",
            "SchemaName": logical_name,
            "DisplayName": label(definition["display"]),
            "DisplayCollectionName": label(definition["plural"]),
            "OwnershipType": "UserOwned",
            "IsActivity": False,
            "HasActivities": False,
            "HasNotes": False,
            "PrimaryNameAttribute": f"{PREFIX}_name",
            "Attributes": [{
                "@odata.type": "#Microsoft.Dynamics.CRM.StringAttributeMetadata",
                "SchemaName": f"{PREFIX}_name",
                "DisplayName": label("Name"),
                "IsPrimaryName": True,
                "RequiredLevel": {"Value": "ApplicationRequired"},
                "FormatName": {"Value": "Text"},
                "MaxLength": 200,
            }],
        }
        create_metadata(
            lambda: api_post("EntityDefinitions", body, solution=SOLUTION_NAME),
            f"Table {logical_name}",
        )
        time.sleep(2)
        metadata = api_get(
            f"EntityDefinitions(LogicalName='{logical_name}')?$select=MetadataId,EntitySetName"
        )
        print(f"Created table '{logical_name}'.")
    elif not is_in_solution(metadata["MetadataId"], solution_id):
        raise RuntimeError(
            f"Table '{logical_name}' already exists outside solution '{SOLUTION_NAME}'; refusing to adopt it."
        )
    else:
        print(f"Using existing solution table '{logical_name}'.")

    for column in definition["columns"]:
        logical = f"{PREFIX}_{column[0]}"
        current = get_optional(
            f"EntityDefinitions(LogicalName='{logical_name}')/Attributes(LogicalName='{logical}')"
            "?$select=LogicalName"
        )
        if current is None:
            create_metadata(
                lambda col=column: api_post(
                    f"EntityDefinitions(LogicalName='{logical_name}')/Attributes",
                    build_column(col),
                    solution=SOLUTION_NAME,
                ),
                f"Column {logical}",
            )
            print(f"  Created column '{logical}'.")


def ensure_lookup(
    source: str, attribute: str, target: str, display: str
) -> None:
    relationships = api_get(
        f"EntityDefinitions(LogicalName='{source}')/ManyToOneRelationships"
        f"?$filter=ReferencedEntity eq '{target}' and ReferencingAttribute eq '{attribute}'"
        "&$select=SchemaName"
    ).get("value", [])
    if relationships:
        return
    existing_attribute = get_optional(
        f"EntityDefinitions(LogicalName='{source}')/Attributes(LogicalName='{attribute}')"
        "?$select=LogicalName"
    )
    if existing_attribute is not None:
        raise RuntimeError(
            f"Lookup attribute '{source}.{attribute}' exists without the expected relationship."
        )
    body = {
        "@odata.type": "#Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
        "SchemaName": f"{source}_{attribute}",
        "ReferencedEntity": target,
        "ReferencingEntity": source,
        "Lookup": {
            "@odata.type": "#Microsoft.Dynamics.CRM.LookupAttributeMetadata",
            "SchemaName": attribute,
            "DisplayName": label(display),
            "RequiredLevel": {"Value": "None"},
        },
    }
    create_metadata(
        lambda: api_post("RelationshipDefinitions", body, solution=SOLUTION_NAME),
        f"Lookup {source}.{attribute}",
    )
    print(f"Created relationship '{source}.{attribute}' -> '{target}'.")


def provision() -> None:
    validate_config()
    solution_id = ensure_solution()
    for logical_name, definition in TABLES.items():
        ensure_table(logical_name, definition, solution_id)
    for source, attribute, target, display in LOOKUPS:
        ensure_lookup(source, attribute, target, display)

    api_post("PublishAllXml", {})
    time.sleep(3)

    values = {}
    for logical_name, key in ENTITY_SET_ENV.items():
        metadata = api_get(
            f"EntityDefinitions(LogicalName='{logical_name}')?$select=EntitySetName"
        )
        values[key] = metadata["EntitySetName"]
        print(f"{logical_name}: EntitySetName verified.")
    save_env_values(values)
    print("Dataverse solution and schema are ready.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Validate and show the planned schema without API writes.")
    args = parser.parse_args()
    validate_config()
    if args.dry_run:
        print(f"Solution: {SOLUTION_NAME} ({SOLUTION_DISPLAY_NAME})")
        for logical_name, definition in TABLES.items():
            print(f"Table: {logical_name} - {len(definition['columns'])} columns")
        for source, attribute, target, _ in LOOKUPS:
            print(f"Lookup: {source}.{attribute} -> {target}")
        return
    provision()


if __name__ == "__main__":
    main()
