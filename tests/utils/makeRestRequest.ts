import { GATEWAY_REST_URL } from "./config";

// Helper for REST API calls to gateway (multipart or JSON).
// If fields contain a File, sends multipart/form-data; otherwise application/json.
export async function makeRestRequest(
  endpoint: string,
  fields: Record<string, string | File>,
  token?: string,
) {
  const hasFile = Object.values(fields).some((v) => v instanceof File);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let body: BodyInit;

  if (hasFile) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    body = formData;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(fields);
  }

  const response = await fetch(`${GATEWAY_REST_URL}${endpoint}`, {
    method: "POST",
    headers,
    body,
  });

  const text = await response.text();
  // console.log(text)
  return JSON.parse(text);
}