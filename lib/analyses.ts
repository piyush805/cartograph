import { createDatabase } from "@/lib/database";

export type AnalysisSummary = {
  id: string;
  status: string;
  commitSha: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  repoOwner: string;
  repoName: string;
};

export const LIST_LIMIT = 50;

// No organization filter: the row-level policy reads the organization off the
// session token, so whichever organization is active is the only one returned.
export async function listAnalyses(): Promise<AnalysisSummary[]> {
  const db = await createDatabase();
  const { data, error } = await db
    .from("analyses")
    .select(
      "id, status, commit_sha, error, created_at, finished_at, projects(repo_owner, repo_name)",
    )
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) throw new Error(`Listing analyses failed: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    status: row.status,
    commitSha: row.commit_sha,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    repoOwner: row.projects.repo_owner,
    repoName: row.projects.repo_name,
  }));
}
