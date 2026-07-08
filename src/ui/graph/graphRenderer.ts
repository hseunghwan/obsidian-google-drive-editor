import { drag } from 'd3-drag';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

import type { GraphModel, GraphNode } from '../../domain/graph/graphModel';
import type { GraphForceSettings } from '../../domain/graph/graphSettings';

export interface GraphRendererOptions {
  forces: GraphForceSettings;
  onNodeClick(nodeId: string): void;
}

export interface GraphRendererHandle {
  setForces(forces: GraphForceSettings): void;
  setSearch(query: string): void;
  destroy(): void;
}

interface SimNode extends GraphNode, SimulationNodeDatum {}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
}

interface NodeVisual {
  node: SimNode;
  holder: Container;
  circle: Graphics;
  label: Text;
}

const labelZoomThreshold = 1.2;

export async function createGraphRenderer(
  container: HTMLElement,
  model: GraphModel,
  options: GraphRendererOptions
): Promise<GraphRendererHandle> {
  // ponytail: 테마 색은 생성 시점 스냅샷 — 전환 시 그래프 재열림으로 충분
  const colors = {
    node: cssColor('--color-lavender', '#a78bfa'),
    nodeHighlight: cssColor('--color-amethyst', '#7c3aed'),
    line: cssColor('--color-graphite', '#3f3f3f'),
    label: cssColor('--color-bright-gray', '#eeeeee')
  };

  const app = new Application();
  await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: container });
  app.ticker.stop();
  container.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);
  const linkGraphics = new Graphics();
  world.addChild(linkGraphics);

  const simNodes: SimNode[] = model.nodes.map((node) => ({ ...node }));
  const simLinks: SimLink[] = model.edges.map((edge) => ({ source: edge.sourceId, target: edge.targetId }));
  const neighborIds = buildNeighborIds(model);

  const labelStyle = new TextStyle({
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 11,
    fill: colors.label
  });

  const visuals: NodeVisual[] = simNodes.map((node) => {
    const radius = nodeRadius(node);
    const circle = new Graphics().circle(0, 0, radius).fill(0xffffff);
    circle.tint = colors.node;
    const label = new Text({ text: node.title, style: labelStyle, resolution: 2 });
    label.anchor.set(0.5, 0);
    label.y = radius + 4;
    label.alpha = 0;
    const holder = new Container();
    holder.addChild(circle);
    holder.addChild(label);
    world.addChild(holder);
    return { node, holder, circle, label };
  });

  let transform: ZoomTransform = zoomIdentity;
  let hoveredId: string | null = null;
  let searchQuery = '';

  function applyStyles() {
    const query = searchQuery.trim().toLocaleLowerCase();
    const hoveredNeighbors = hoveredId ? neighborIds.get(hoveredId) : undefined;
    for (const visual of visuals) {
      const matchesSearch = !query || visual.node.title.toLocaleLowerCase().includes(query);
      const isHovered = hoveredId === visual.node.id;
      const isNeighbor = Boolean(hoveredNeighbors?.has(visual.node.id));
      let alpha = matchesSearch ? 1 : 0.15;
      if (hoveredId && !isHovered && !isNeighbor) {
        alpha = Math.min(alpha, 0.2);
      }
      visual.holder.alpha = alpha;
      visual.circle.tint = isHovered ? colors.nodeHighlight : colors.node;
      visual.label.alpha = isHovered || isNeighbor || transform.k > labelZoomThreshold ? 1 : 0;
    }
  }

  function render() {
    for (const visual of visuals) {
      visual.holder.position.set(visual.node.x ?? 0, visual.node.y ?? 0);
    }
    linkGraphics.clear();
    for (const link of simLinks) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      const dimmed = hoveredId !== null && source.id !== hoveredId && target.id !== hoveredId;
      linkGraphics
        .moveTo(source.x ?? 0, source.y ?? 0)
        .lineTo(target.x ?? 0, target.y ?? 0)
        .stroke({ width: 1, color: colors.line, alpha: dimmed ? 0.15 : 0.5 });
    }
    app.render();
  }

  const linkForce = forceLink<SimNode, SimLink>(simLinks).id((node) => node.id);
  const chargeForce = forceManyBody<SimNode>();
  const centerForce = forceCenter<SimNode>(container.clientWidth / 2, container.clientHeight / 2);
  const collideForce = forceCollide<SimNode>().radius((node) => nodeRadius(node) + 4);

  const sim = forceSimulation(simNodes)
    .force('link', linkForce)
    .force('charge', chargeForce)
    .force('center', centerForce)
    .force('collide', collideForce)
    .on('tick', render);

  function applyForces(forces: GraphForceSettings) {
    centerForce.strength(forces.centerStrength);
    chargeForce.strength(-30 * forces.repelStrength);
    linkForce.distance(forces.linkDistance).strength(forces.linkStrength);
  }
  applyForces(options.forces);
  sim.alpha(1).restart();

  function findNodeAt(worldX: number, worldY: number): SimNode | null {
    let closest: SimNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const node of simNodes) {
      const distance = Math.hypot((node.x ?? 0) - worldX, (node.y ?? 0) - worldY);
      if (distance < nodeRadius(node) + 3 && distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    }
    return closest;
  }

  function hitTest(clientX: number, clientY: number): SimNode | null {
    const rect = app.canvas.getBoundingClientRect();
    const [worldX, worldY] = transform.invert([clientX - rect.left, clientY - rect.top]);
    return findNodeAt(worldX, worldY);
  }

  const canvasSelection = select(app.canvas);

  const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.1, 4])
    .filter((event: MouseEvent | WheelEvent) => {
      if (event.type === 'wheel') {
        return true;
      }
      return hitTest(event.clientX, event.clientY) === null;
    })
    .on('zoom', (event) => {
      transform = event.transform;
      world.position.set(transform.x, transform.y);
      world.scale.set(transform.k);
      applyStyles();
      render();
    });
  canvasSelection.call(zoomBehavior);

  const dragBehavior = drag<HTMLCanvasElement, unknown>()
    .container(app.canvas)
    .subject((event) => {
      const [worldX, worldY] = transform.invert([event.x, event.y]);
      return findNodeAt(worldX, worldY) ?? undefined;
    })
    .on('start', (event) => {
      const node = event.subject as SimNode;
      node.fx = node.x;
      node.fy = node.y;
      sim.alphaTarget(0.3).restart();
    })
    .on('drag', (event) => {
      const node = event.subject as SimNode;
      const [worldX, worldY] = transform.invert([event.x, event.y]);
      node.fx = worldX;
      node.fy = worldY;
    })
    .on('end', (event) => {
      const node = event.subject as SimNode;
      node.fx = null;
      node.fy = null;
      sim.alphaTarget(0);
    });
  canvasSelection.call(dragBehavior);

  function handlePointerMove(event: PointerEvent) {
    const node = hitTest(event.clientX, event.clientY);
    const nextId = node?.id ?? null;
    if (nextId !== hoveredId) {
      hoveredId = nextId;
      app.canvas.style.cursor = node ? 'pointer' : 'default';
      applyStyles();
      render();
    }
  }

  function handleClick(event: MouseEvent) {
    const node = hitTest(event.clientX, event.clientY);
    if (node) {
      options.onNodeClick(node.id);
    }
  }

  app.canvas.addEventListener('pointermove', handlePointerMove);
  app.canvas.addEventListener('click', handleClick);

  const resizeObserver = new ResizeObserver(() => {
    centerForce.x(container.clientWidth / 2).y(container.clientHeight / 2);
    render();
  });
  resizeObserver.observe(container);

  return {
    setForces(forces) {
      applyForces(forces);
      sim.alpha(0.5).restart();
    },
    setSearch(query) {
      searchQuery = query;
      applyStyles();
      render();
    },
    destroy() {
      resizeObserver.disconnect();
      sim.stop();
      canvasSelection.on('.zoom', null).on('.drag', null);
      app.canvas.removeEventListener('pointermove', handlePointerMove);
      app.canvas.removeEventListener('click', handleClick);
      app.destroy(true, { children: true, texture: true });
    }
  };
}

function nodeRadius(node: GraphNode) {
  return 4 + 2 * Math.sqrt(node.degree);
}

function buildNeighborIds(model: GraphModel) {
  const neighborIds = new Map<string, Set<string>>();
  for (const edge of model.edges) {
    ensure(neighborIds, edge.sourceId).add(edge.targetId);
    ensure(neighborIds, edge.targetId).add(edge.sourceId);
  }
  return neighborIds;
}

function ensure(map: Map<string, Set<string>>, key: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
