import { supabase } from "./supabase";

type AnyJobPayload = Record<string, any>;

function removeUndefinedValues(
  payload: AnyJobPayload
) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined
    )
  );
}

function extractMissingColumnName(
  message: string
) {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /record "new" has no field "([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function insertJobWithSchemaFallback(
  payload: AnyJobPayload,
  removedColumns: string[] = []
): Promise<any[]> {
  const cleanPayload = removeUndefinedValues(payload);

  const { data, error } = await supabase
    .from("jobs")
    .insert([cleanPayload])
    .select();

  if (!error) {
    if (removedColumns.length > 0) {
      console.warn(
        "Job uploaded, but these fields were ignored because they do not exist in Supabase jobs table:",
        removedColumns
      );
    }

    return data || [];
  }

  const errorMessage =
    error.message ||
    error.details ||
    JSON.stringify(error);

  const missingColumn =
    extractMissingColumnName(errorMessage);

  if (
    missingColumn &&
    Object.prototype.hasOwnProperty.call(
      cleanPayload,
      missingColumn
    )
  ) {
    const nextPayload = {
      ...cleanPayload,
    };

    delete nextPayload[missingColumn];

    return insertJobWithSchemaFallback(
      nextPayload,
      [
        ...removedColumns,
        missingColumn,
      ]
    );
  }

  console.log(error);

  throw new Error(
    error.message ||
      "Upload JD failed while saving job"
  );
}

export async function saveJob(
  job: AnyJobPayload
) {
  return insertJobWithSchemaFallback(job);
}
