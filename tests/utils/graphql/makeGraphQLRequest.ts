import { GATEWAY_URL } from "../config";

// Helper function to make GraphQL requests
export async function makeGraphQLRequest(
  query: string,
  variables: Record<string, any>,
  token?: string,
  file?: File
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let body;
  if (file) {
    // Create FormData for file upload
    const formData = new FormData();

    // Add the operation
    const operations = {
      query,
      variables: {
        input: {
          ...variables.input,
          file: null,
        },
      },
    };
    formData.append("operations", JSON.stringify(operations));

    // Add the map
    const map = {
      "0": ["variables.input.file"],
    };
    formData.append("map", JSON.stringify(map));

    // Add the file
    formData.append("0", file);

    body = formData;
    delete headers["Content-Type"]; // Let browser set the correct content type with boundary
  } else {
    body = JSON.stringify({
      query,
      variables,
    });
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers,
    body,
  });

  return response.json();
}
