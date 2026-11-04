export type ApiResult = {
  error?: string;
  fields?: Record<string, string[]>;
  message?: string;
  redirect?: string;
};
export async function mutate(
  path: string,
  data: unknown,
  method = "POST",
): Promise<ApiResult> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result: ApiResult = await response.json();
  if (!response.ok && !result.error)
    return { error: "The request failed. Please try again." };
  return result;
}
