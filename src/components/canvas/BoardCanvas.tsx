import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  ConnectionMode,
  MarkerType,
  applyNodeChanges,
  useReactFlow,
  useStoreApi,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Card as CardModel, CardId, CardType } from '../../types'
import { CARD_H, CARD_W } from '../../board/constants'
import { cardsInCell, cellAt, computeLayout, insertIndexAt, type Cell } from '../../board/layout'
import { slotOf } from '../../board/slots'
import { checkSchedule, downstream, upstream } from '../../board/dependencies'
import { useBoardStore } from '../../store/boardStore'
import { useCardStore } from '../../store/cardStore'
import { useViewStore } from '../../store/viewStore'
import { Card, type CardNodeData } from './Card'
import { DependencyEdge, type DependencyEdgeData } from './DependencyEdge'
import { edgeAppearance } from '../../lib/edgeStyle'
import { MatrixBackground, StickyHeaders } from './MatrixBackground'

const nodeTypes: NodeTypes = { card: Card as NodeTypes[string] }
const edgeTypes: EdgeTypes = { dependency: DependencyEdge as EdgeTypes[string] }

interface Props {
  onCardContextMenu: (cardId: CardId, x: number, y: number) => void
  onCanvasContextMenu: (x: number, y: number, cell: Cell | null) => void
  onCreateCard: (cell: Cell) => void
  /** While set, the next card clicked becomes the card that needs this one. */
  linkFromId: CardId | null
  onLinkTo: (cardId: CardId) => void
}

interface CachedNode {
  card: CardModel
  type: CardType | undefined
  x: number
  y: number
  dimmed: boolean
  selected: boolean
  inCount: number
  outCount: number
  ownerName?: string
  h: number
  node: Node
}

function BoardCanvasInner({ onCardContextMenu, onCanvasContextMenu, onCreateCard, linkFromId, onLinkTo }: Props) {
  const pi = useBoardStore((s) => s.pi)
  const teams = useBoardStore((s) => s.teams)
  const sprints = useBoardStore((s) => s.sprints)
  const cardTypes = useBoardStore((s) => s.cardTypes)
  const externalLane = useBoardStore((s) => s.externalLane)
  const cards = useCardStore((s) => s.cards)
  const dependencies = useCardStore((s) => s.dependencies)

  const activeTypeId = useViewStore((s) => s.activeTypeId)
  const activeLaneId = useViewStore((s) => s.activeLaneId)
  const focusCardId = useViewStore((s) => s.focusCardId)
  const selectedDependencyId = useViewStore((s) => s.selectedDependencyId)
  const panTarget = useViewStore((s) => s.panTarget)
  const fitNonce = useViewStore((s) => s.fitNonce)

  const { screenToFlowPosition, setCenter, setViewport, getZoom } = useReactFlow()
  const storeApi = useStoreApi()
  const [hoverCell, setHoverCell] = useState<Cell | null>(null)

  const config = useMemo(
    () => ({ pi, teams, sprints, cardTypes, externalLane }),
    [pi, teams, sprints, cardTypes, externalLane],
  )

  // Positions are derived: recomputed only when cards, teams or sprints change
  const layout = useMemo(
    () => computeLayout({ pi, teams, sprints, cardTypes, externalLane }, cards),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, sprints, cards],
  )

  const teamNames = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])
  const typesById = useMemo(() => new Map(cardTypes.map((t) => [t.id, t])), [cardTypes])
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const cardsRecord = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])) as Record<CardId, CardModel>, [cards])

  const counts = useMemo(() => {
    const inC = new Map<CardId, number>()
    const outC = new Map<CardId, number>()
    for (const d of dependencies) {
      outC.set(d.from, (outC.get(d.from) ?? 0) + 1)
      inC.set(d.to, (inC.get(d.to) ?? 0) + 1)
    }
    return { inC, outC }
  }, [dependencies])

  // Focus mode: the selected card, everything upstream and everything downstream stay lit
  const lit = useMemo(() => {
    if (!focusCardId || !cardsById.has(focusCardId)) return null
    const set = new Set<CardId>([focusCardId])
    upstream(focusCardId, dependencies).forEach((id) => set.add(id))
    downstream(focusCardId, dependencies).forEach((id) => set.add(id))
    return set
  }, [focusCardId, dependencies, cardsById])

  const isDimmed = useCallback(
    (c: CardModel) =>
      (lit !== null && !lit.has(c.id)) ||
      (activeTypeId !== null && c.typeId !== activeTypeId) ||
      (activeLaneId !== null && c.laneId !== activeLaneId),
    [lit, activeTypeId, activeLaneId],
  )

  // Derived React Flow nodes. Unchanged cards keep their previous node object.
  const nodeCache = useRef(new Map<CardId, CachedNode>())
  const derivedNodes: Node[] = useMemo(() => {
    const next = new Map<CardId, CachedNode>()
    const out = cards.map((card) => {
      const pos = layout.cardPos[card.id] ?? { x: 0, y: 0 }
      const type = typesById.get(card.typeId)
      const dimmed = isDimmed(card)
      const selected = card.id === focusCardId
      const inCount = counts.inC.get(card.id) ?? 0
      const outCount = counts.outC.get(card.id) ?? 0
      const ownerName = card.owner ? teamNames.get(card.owner) : undefined
      const prev = nodeCache.current.get(card.id)
      if (
        prev && prev.card === card && prev.type === type && prev.x === pos.x && prev.y === pos.y &&
        prev.dimmed === dimmed && prev.selected === selected && prev.inCount === inCount && prev.outCount === outCount && prev.ownerName === ownerName && prev.h === (layout.cardH[card.id] ?? CARD_H)
      ) {
        next.set(card.id, prev)
        return prev.node
      }
      const data: CardNodeData = { card, type, dimmed, inCount, outCount, ownerName }
      const node: Node = {
        id: card.id,
        type: 'card',
        position: pos,
        // Sized through style so React Flow measures the DOM and keeps handle bounds up to date
        style: { width: CARD_W, height: layout.cardH[card.id] ?? CARD_H },
        initialWidth: CARD_W,
        initialHeight: layout.cardH[card.id] ?? CARD_H,
        selected,
        data,
      }
      next.set(card.id, { card, type, x: pos.x, y: pos.y, dimmed, selected, inCount, outCount, ownerName, h: layout.cardH[card.id] ?? CARD_H, node })
      return node
    })
    nodeCache.current = next
    return out
  }, [cards, layout, typesById, teamNames, isDimmed, focusCardId, counts])

  // React Flow owns a node's position while it is being dragged; this local copy
  // is never written to the stores. Every derived change flows back in here.
  const [nodes, setNodes] = useState<Node[]>(derivedNodes)
  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return derivedNodes.map((n) => {
        const p = prevById.get(n.id)
        if (p && p.data === n.data && p.position.x === n.position.x && p.position.y === n.position.y && p.selected === n.selected) return p
        return { ...n, measured: p && p.style?.height === n.style?.height ? p.measured : undefined }
      })
    })
  }, [derivedNodes])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns))
    const selects = changes.filter((c): c is Extract<NodeChange, { type: 'select' }> => c.type === 'select')
    if (selects.length) {
      const chosen = selects.find((c) => c.selected)
      const view = useViewStore.getState()
      if (chosen) view.setFocusCard(chosen.id)
      else if (selects.some((c) => c.id === view.focusCardId)) view.setFocusCard(null)
    }
  }, [])

  const rfEdges: Edge[] = useMemo(
    () =>
      dependencies.map((d) => {
        const from = cardsById.get(d.from)
        const to = cardsById.get(d.to)
        const check = checkSchedule(d, cardsRecord, sprints)
        const { colour } = edgeAppearance(d.state, check)
        const dimmed = (from ? isDimmed(from) : false) || (to ? isDimmed(to) : false)
        const data: DependencyEdgeData = { depId: d.id, label: d.label, state: d.state, check, dimmed }
        return {
          id: d.id,
          source: d.from,
          target: d.to,
          sourceHandle: 'out',
          targetHandle: 'in',
          type: 'dependency',
          selected: d.id === selectedDependencyId,
          markerEnd: { type: MarkerType.ArrowClosed, color: colour, width: 16, height: 16 },
          data,
        }
      }),
    [dependencies, cardsById, cardsRecord, sprints, isDimmed, selectedDependencyId],
  )

  // ── Pan / fit requests ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!panTarget) return
    let target: { x: number; y: number } | null = null
    if (panTarget.kind === 'card') {
      const p = layout.cardPos[panTarget.id]
      if (p) target = { x: p.x + CARD_W / 2, y: p.y + (layout.cardH[panTarget.id] ?? CARD_H) / 2 }
    } else {
      const d = useCardStore.getState().dependencies.find((dep) => dep.id === panTarget.id)
      const a = d && layout.cardPos[d.from]
      const b = d && layout.cardPos[d.to]
      if (a && b) target = { x: (a.x + b.x) / 2 + CARD_W / 2, y: (a.y + b.y) / 2 + CARD_H / 2 }
    }
    if (target) void setCenter(target.x, target.y, { zoom: Math.max(getZoom(), 0.8), duration: 400 })
  }, [panTarget]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the whole matrix, anchored to the top so the pinned headers line up with it
  const fit = useCallback((animate = true) => {
    const { width, height } = storeApi.getState()
    if (!width || !height) return
    const zoom = Math.max(0.15, Math.min(1, width / layout.width, height / layout.height))
    const x = Math.max(0, (width - layout.width * zoom) / 2)
    void setViewport({ x, y: 0, zoom }, { duration: animate ? 300 : 0 })
  }, [setViewport, storeApi, layout.width, layout.height])

  useEffect(() => {
    if (fitNonce > 0) fit()
  }, [fitNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // A board opened without a saved viewport starts fitted to the matrix. Wait a tick
  // so React Flow has measured its pane.
  useEffect(() => {
    const v = useViewStore.getState().viewport
    if (!(v.x === 0 && v.y === 0 && v.zoom === 1)) return
    const t = setTimeout(() => fit(false), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Interaction ────────────────────────────────────────────────────────────

  const centreOf = useCallback(
    (n: Node) => ({ x: n.position.x + CARD_W / 2, y: n.position.y + (n.measured?.height ?? n.height ?? CARD_H) / 2 }),
    [],
  )

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const c = centreOf(node)
      const cell = cellAt(layout, c.x, c.y)
      setHoverCell((prev) => (prev?.laneId === cell?.laneId && prev?.sprintId === cell?.sprintId && prev?.slot === cell?.slot ? prev : cell))
    },
    [layout, centreOf],
  )

  const resetPositions = useCallback(() => {
    setNodes((ns) => ns.map((n) => {
      const d = derivedNodes.find((x) => x.id === n.id)
      return d ? { ...n, position: d.position } : n
    }))
  }, [derivedNodes])

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHoverCell(null)
      const c = centreOf(node)
      const cell = cellAt(layout, c.x, c.y)
      const moving = cardsById.get(node.id)
      if (!cell || !moving) {
        resetPositions() // dropped outside any cell: snap back
        return
      }
      let index = insertIndexAt(layout, cards, cell, c.y)
      if (moving.laneId === cell.laneId && moving.sprintId === cell.sprintId && slotOf(moving) === cell.slot) {
        const oldIndex = cardsInCell(cards, cell).findIndex((x) => x.id === moving.id)
        if (oldIndex >= 0 && index > oldIndex) index -= 1
      }
      useCardStore.getState().moveCard(node.id, cell.laneId, cell.sprintId, index, cell.slot)
      resetPositions() // if the move changed nothing, the card still returns to its slot
    },
    [layout, cards, cardsById, resetPositions, centreOf],
  )

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    const dep = useCardStore.getState().addDependency({ from: connection.source, to: connection.target })
    if (dep) useViewStore.getState().openDependency(dep.id)
  }, [])

  const onNodesDelete = useCallback((deleted: Node[]) => {
    deleted.forEach((n) => useCardStore.getState().deleteCard(n.id))
    useViewStore.getState().setFocusCard(null)
  }, [])

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    deleted.forEach((e) => useCardStore.getState().deleteDependency(e.id))
    useViewStore.getState().selectDependency(null)
  }, [])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (linkFromId) onLinkTo(node.id)
    },
    [linkFromId, onLinkTo],
  )

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    useViewStore.getState().openDependency(edge.id)
  }, [])

  const cellFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const p = screenToFlowPosition({ x: clientX, y: clientY })
      return cellAt(layout, p.x, p.y)
    },
    [screenToFlowPosition, layout],
  )

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge') || target.closest('.react-flow__controls')) return
      const cell = cellFromEvent(event.clientX, event.clientY)
      if (cell) onCreateCard(cell)
    },
    [cellFromEvent, onCreateCard],
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      onCardContextMenu(node.id, event.clientX, event.clientY)
    },
    [onCardContextMenu],
  )

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      onCanvasContextMenu(event.clientX, event.clientY, cellFromEvent(event.clientX, event.clientY))
    },
    [cellFromEvent, onCanvasContextMenu],
  )

  const onPaneClick = useCallback(() => {
    useViewStore.getState().selectDependency(null)
  }, [])

  const onMove = useCallback((_: unknown, viewport: { x: number; y: number; zoom: number }) => {
    useViewStore.getState().setViewport(viewport)
  }, [])

  const dimLane = activeLaneId

  return (
    <ReactFlow
      nodes={nodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Strict}
      onNodesChange={onNodesChange}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      onConnectEnd={(_e, st) => console.log('DBG connectEnd', st.isValid, st.fromNode?.id?.slice(0,4), st.toNode?.id?.slice(0,4), st.toHandle?.id)}
      onConnectStart={(_e, p) => console.log('DBG connectStart', p.nodeId?.slice(0,4), p.handleId)}
      isValidConnection={(c) => c.source !== c.target}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onDoubleClick={onDoubleClick}
      onNodeContextMenu={onNodeContextMenu}
      onPaneContextMenu={onPaneContextMenu}
      onPaneClick={onPaneClick}
      onMove={onMove}
      defaultViewport={useViewStore.getState().viewport}
      minZoom={0.15}
      maxZoom={2}
      zoomOnDoubleClick={false}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      deleteKeyCode="Delete"
      nodesConnectable
      fitView={false}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
      className={linkFromId ? 'cursor-crosshair' : undefined}
    >
      <MatrixBackground layout={layout} hoverCell={hoverCell} dimLane={dimLane} />
      <StickyHeaders layout={layout} config={config} dimLane={dimLane} />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  )
}

export function BoardCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <BoardCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
