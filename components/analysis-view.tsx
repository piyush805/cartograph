"use client";

import { useCallback, useMemo, useState } from "react";
import { CategoryRail } from "@/components/category-rail";
import { DependencyMap } from "@/components/dependency-map";
import { DetailPane } from "@/components/detail-pane";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  neighbourIndex,
  type DetailFile,
  type RepositorySummary,
} from "@/lib/detail";
import type { Category } from "@/lib/map/categories";
import { fold } from "@/lib/map/fold";
import type { FileLink } from "@/lib/map/graph";
import type { Selection } from "@/lib/map/highlight";

// Selection and hover live here because the map and the pane both read and
// set them. Everything either one shows is derived in the browser from these
// props, so selecting or hovering never makes a request.
export function AnalysisView({
  repository,
  files,
  links,
  categories,
  summary,
}: {
  repository: string;
  files: DetailFile[];
  links: FileLink[];
  categories: Category[];
  summary: RepositorySummary;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hover, setHover] = useState<Selection | null>(null);

  const folding = useMemo(() => fold(files), [files]);
  const { groups, groupOf } = useMemo(() => {
    const groupOf = new Map<string, string>();
    for (const group of folding.groups) {
      for (const path of group.files) groupOf.set(path, group.dir);
    }
    return {
      groups: new Map(folding.groups.map((group) => [group.dir, group])),
      groupOf,
    };
  }, [folding]);
  const filesByPath = useMemo(
    () => new Map(files.map((file) => [file.path, file])),
    [files],
  );
  const neighbours = useMemo(() => neighbourIndex(links), [links]);

  const selectPath = useCallback(
    (path: string) => {
      const dir = groupOf.get(path);
      if (dir !== undefined) setSelection({ kind: "file", dir, path });
    },
    [groupOf],
  );

  return (
    <WorkspaceShell
      rail={<CategoryRail categories={categories} />}
      map={
        <DependencyMap
          files={files}
          links={links}
          folding={folding}
          selection={selection}
          onSelect={setSelection}
          hover={hover}
          onHover={setHover}
        />
      }
      detail={
        <DetailPane
          repository={repository}
          summary={summary}
          selection={selection}
          filesByPath={filesByPath}
          groups={groups}
          links={links}
          neighbours={neighbours}
          hover={hover}
          groupOf={groupOf}
          onSelectPath={selectPath}
          onHover={setHover}
        />
      }
    />
  );
}
