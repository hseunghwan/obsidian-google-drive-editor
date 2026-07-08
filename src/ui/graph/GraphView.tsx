import React, { useEffect, useRef, useState } from 'react';

import { scanVaultLinks } from '../../app/graphScanner';
import { buildGraphModel } from '../../domain/graph/graphModel';
import {
  defaultGraphForceSettings,
  parseGraphForceSettings,
  type GraphForceSettings
} from '../../domain/graph/graphSettings';
import type { VaultFile, VaultFolder, VaultRoot } from '../../domain/vault/types';
import { useI18n } from '../../i18n/I18nProvider';
import { IndexedDbGraphLinkStore, type GraphLinkStore } from '../../storage/graphLinkStore';
import type { GraphRendererHandle } from './graphRenderer';

const forceStorageKey = 'drive-obsidian-editor:graph-forces';

export interface GraphViewProps {
  root: VaultRoot;
  loadFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  loadMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  readFileContent(fileId: string): Promise<string>;
  loadGraphSettings?(): Promise<unknown>;
  onOpenFile(file: VaultFile): void;
  linkStore?: GraphLinkStore;
}

type GraphPhase = 'scanning' | 'ready' | 'empty' | 'rendererFailed';

interface ForceSliderConfig {
  key: keyof GraphForceSettings;
  labelKey: 'graph.centerStrength' | 'graph.repelStrength' | 'graph.linkStrength' | 'graph.linkDistance';
  min: number;
  max: number;
  step: number;
}

const forceSliders: ForceSliderConfig[] = [
  { key: 'centerStrength', labelKey: 'graph.centerStrength', min: 0, max: 1, step: 0.01 },
  { key: 'repelStrength', labelKey: 'graph.repelStrength', min: 0, max: 20, step: 0.5 },
  { key: 'linkStrength', labelKey: 'graph.linkStrength', min: 0, max: 2, step: 0.05 },
  { key: 'linkDistance', labelKey: 'graph.linkDistance', min: 30, max: 500, step: 10 }
];

export function GraphView({
  root,
  loadFolders,
  loadMarkdownFiles,
  readFileContent,
  loadGraphSettings,
  onOpenFile,
  linkStore
}: GraphViewProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<GraphPhase>('scanning');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failedCount, setFailedCount] = useState(0);
  const [forces, setForces] = useState<GraphForceSettings>(defaultGraphForceSettings);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GraphRendererHandle | null>(null);
  const filesRef = useRef(new Map<string, VaultFile>());

  useEffect(() => {
    let cancelled = false;
    const store = linkStore ?? new IndexedDbGraphLinkStore();

    async function openGraph() {
      setPhase('scanning');
      setFailedCount(0);

      const initialForces = await resolveInitialForces(loadGraphSettings);
      if (cancelled) {
        return;
      }
      setForces(initialForces);

      const scan = await scanVaultLinks({
        vaultRootId: root.id,
        listFolders: loadFolders,
        listMarkdownFiles: loadMarkdownFiles,
        readFileContent,
        store,
        onProgress: (done, total) => {
          if (!cancelled) {
            setProgress({ done, total });
          }
        },
        isCancelled: () => cancelled
      });
      if (cancelled) {
        return;
      }

      setFailedCount(scan.failedFileIds.length);
      filesRef.current = new Map(scan.files.map((entry) => [entry.id, entry]));
      if (scan.files.length === 0) {
        setPhase('empty');
        return;
      }

      const model = buildGraphModel(scan.files, scan.wikiLinksByFileId);
      try {
        const { createGraphRenderer } = await import('./graphRenderer');
        if (cancelled || !containerRef.current) {
          return;
        }
        const renderer = await createGraphRenderer(containerRef.current, model, {
          forces: initialForces,
          onNodeClick: (nodeId) => {
            const target = filesRef.current.get(nodeId);
            if (target) {
              onOpenFile(target);
            }
          }
        });
        if (cancelled) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        setPhase('ready');
      } catch {
        if (!cancelled) {
          setPhase('rendererFailed');
        }
      }
    }

    void openGraph();
    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // eslint 없음 — 의도된 의존성: 재시도와 vault 전환 시에만 재실행
  }, [root.id, retryToken]);

  function updateForce(key: keyof GraphForceSettings, value: number) {
    setForces((current) => {
      const next = { ...current, [key]: value };
      rendererRef.current?.setForces(next);
      try {
        window.localStorage?.setItem(forceStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  function updateSearch(value: string) {
    setSearchQuery(value);
    rendererRef.current?.setSearch(value);
  }

  return (
    <div className="graph-view" data-testid="graph-view">
      <div className="graph-toolbar">
        <input
          type="search"
          value={searchQuery}
          placeholder={t('graph.searchPlaceholder')}
          onChange={(event) => updateSearch(event.target.value)}
        />
        <details className="graph-forces">
          <summary>{t('graph.forces')}</summary>
          {forceSliders.map((slider) => (
            <label key={slider.key}>
              <span>{t(slider.labelKey)}</span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={forces[slider.key]}
                onChange={(event) => updateForce(slider.key, Number(event.target.value))}
              />
            </label>
          ))}
        </details>
      </div>
      {failedCount > 0 ? (
        <div className="graph-banner" role="alert">
          <span>
            {t('graph.readFailures')} ({failedCount})
          </span>
          <button type="button" onClick={() => setRetryToken((token) => token + 1)}>
            {t('graph.retry')}
          </button>
        </div>
      ) : null}
      <div className="graph-canvas" ref={containerRef}>
        {phase === 'scanning' ? (
          <p className="graph-status">
            {t('graph.scanning')}
            {progress.total > 0 ? ` (${progress.done}/${progress.total})` : ''}
          </p>
        ) : null}
        {phase === 'empty' ? <p className="graph-status">{t('graph.empty')}</p> : null}
        {phase === 'rendererFailed' ? <p className="graph-status">{t('graph.rendererFailed')}</p> : null}
      </div>
    </div>
  );
}

async function resolveInitialForces(loadGraphSettings?: () => Promise<unknown>): Promise<GraphForceSettings> {
  try {
    const stored = window.localStorage?.getItem(forceStorageKey);
    if (stored) {
      return parseGraphForceSettings(JSON.parse(stored));
    }
  } catch {
    // ignore storage failures
  }
  try {
    if (loadGraphSettings) {
      return parseGraphForceSettings(await loadGraphSettings());
    }
  } catch {
    // ignore settings load failures
  }
  return defaultGraphForceSettings;
}
