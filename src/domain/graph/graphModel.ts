import type { VaultFile } from '../vault/types';
import { findWikiLinkTarget } from '../vault/wikiLinkResolution';

export interface GraphNode {
  id: string;
  title: string;
  path: string;
  degree: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraphModel(files: VaultFile[], wikiLinksByFileId: Map<string, string[]>): GraphModel {
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];
  const degrees = new Map<string, number>();

  for (const source of files) {
    for (const target of wikiLinksByFileId.get(source.id) ?? []) {
      // ponytail: 링크마다 O(files) 선형 탐색 — 수백 노트 규모에선 충분, 수만 링크가 되면 조회 맵 도입
      const targetFile = findWikiLinkTarget(files, target);
      if (!targetFile || targetFile.id === source.id) {
        continue;
      }
      const key = [source.id, targetFile.id].sort().join('->');
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push({ sourceId: source.id, targetId: targetFile.id });
      degrees.set(source.id, (degrees.get(source.id) ?? 0) + 1);
      degrees.set(targetFile.id, (degrees.get(targetFile.id) ?? 0) + 1);
    }
  }

  return {
    nodes: files.map((file) => ({
      id: file.id,
      title: file.title,
      path: file.path,
      degree: degrees.get(file.id) ?? 0
    })),
    edges
  };
}
