// ---------------------------------------------------------------------------
// CanvasOffice — Canvas 2D office renderer using full pixel-agents engine
// Fit-width layout: canvas sized to full map, native browser scrolling
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OFFICE_LAYOUT } from './office-layout'
import { type AgentDesk, type InteractionType } from './types'
import type { AgentStatus, SessionInfo } from './pixel-types'
import { OfficeState } from './engine/officeState'
import { renderFrame, type SelectionRenderState, type IdentityOverlay } from './engine/renderer'
import { TILE_SIZE } from './pixel-types'
import { MAX_DELTA_TIME_SEC, COLOR_NAME_TO_HEX, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_SNAP_THRESHOLD, CAMERA_DEADZONE_FRACTION } from './constants'
import { loadAllAssets, onTilesetReady } from './asset-loader'
import { CharacterState, Direction } from './pixel-types'
import { ROOM_ZONES, getZoneAt } from './engine/roomZones'

// Agent lookup maps — built from runtime agents inside the component via useMemo

// Zoom bounds
const MIN_ZOOM_ABSOLUTE = 1
const MAX_ZOOM_ABSOLUTE = 8
const ZOOM_STEP = 0.15 // per wheel tick

const TOOL_VERBS: Record<string, string> = {
  Read: 'reading', Edit: 'editing', Write: 'writing',
  Bash: 'running', Grep: 'searching', Glob: 'scanning',
  Agent: 'delegating', WebFetch: 'fetching', WebSearch: 'searching',
  TodoRead: 'checking todos', TodoWrite: 'updating todos', TaskOutput: 'reading output',
}

function formatActivity(tool?: string, detail?: string): string | undefined {
  if (!tool) return undefined
  const verb = TOOL_VERBS[tool] ?? tool.toLowerCase()
  if (!detail) return verb
  // Strip paths to just filename (filter(Boolean) handles trailing slashes)
  const filename = detail.includes('/') ? detail.split('/').filter(Boolean).pop() ?? detail : detail
  return `${verb} ${filename}`
}

/** Tooltip state for room hover */
interface TooltipState {
  x: number
  y: number
  roomName: string
  agents: string[]
}

/** Item click info passed up to GamePage */
export interface ClickedItem {
  type: 'desk' | 'furniture' | 'server' | 'conference' | 'wall' | 'whiteboard' | 'bookshelf'
  col: number
  row: number
  agentName?: string
}

interface CanvasOfficeProps {
  /** Runtime office agents from registry (with game config) */
  agents: AgentDesk[]
  onAgentClick?: (agentName: string) => void
  onItemClick?: (item: ClickedItem | null) => void
  agentStatuses: Record<string, AgentStatus>
  /** Per-agent session context (task name, active tool) for Character.sessionInfo */
  agentSessionInfos?: Record<string, SessionInfo>
  /** Per-agent busy flag (multiple active sessions) */
  agentBusyMap?: Record<string, boolean>
  /** Agent interaction pairs with type (derived from directive pipeline step) */
  agentInteractions?: Array<[string, string, InteractionType]>
  /** Directed parent→children map for meeting room routing */
  subagentsByParent?: Map<string, string[]>
  /** Review interactions: reviewerAgentName -> builderAgentName */
  reviewInteractions?: Map<string, string>
  selectedAgentName?: string | null
}

export default function CanvasOffice({
  agents,
  onAgentClick,
  onItemClick,
  agentStatuses,
  agentSessionInfos,
  agentBusyMap,
  agentInteractions,
  subagentsByParent,
  reviewInteractions,
  selectedAgentName,
}: CanvasOfficeProps) {
  // Build lookup maps from runtime agents
  const AGENT_ID_TO_NAME = useMemo(() => new Map(agents.map((a) => [a.id, a.isPlayer ? 'You' : a.agentName])), [agents])
  const AGENT_NAME_TO_ID = useMemo(() => new Map(agents.map((a) => [a.agentName, a.id])), [agents])
  const AGENT_ID_TO_REAL_NAME = useMemo(() => new Map(agents.map((a) => [a.id, a.agentName])), [agents])
  const AGENT_ID_TO_COLOR = useMemo(() => new Map(agents.map((a) => [a.id, COLOR_NAME_TO_HEX[a.color] ?? '#9ca3af'])), [agents])
  const CEO_AGENT = useMemo(() => agents.find((a) => a.isPlayer) ?? null, [agents])
  const CEO_ID = CEO_AGENT?.id ?? null

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<OfficeState | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const propsRef = useRef({ onAgentClick, onItemClick, agentStatuses, agentSessionInfos, agentBusyMap, agentInteractions, subagentsByParent, reviewInteractions, selectedAgentName })
  propsRef.current = { onAgentClick, onItemClick, agentStatuses, agentSessionInfos, agentBusyMap, agentInteractions, subagentsByParent, reviewInteractions, selectedAgentName }

  // Zoom state: fitZoom is the baseline (fit map width to container), zoom is current
  const [fitZoom, setFitZoom] = useState(3)
  const [zoom, setZoom] = useState(3)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Get map dimensions from state (or fallback)
  const getMapDims = useCallback(() => {
    const state = stateRef.current
    const cols = state ? (state.tileMap[0]?.length ?? 1) : 1
    const rows = state ? state.tileMap.length : 1
    return { cols, rows }
  }, [])

  // Initialize office state + add agents + load assets
  useEffect(() => {
    if (agents.length === 0) return // Wait for runtime agents to load
    const state = new OfficeState(OFFICE_LAYOUT)
    for (const agent of agents) {
      state.addAgent(agent.id, agent.palette, agent.hueShift, agent.seatId, true)
    }
    // Mark CEO as player-controlled and start idle (not typing at desk)
    if (CEO_ID !== null) {
      const ceoCh = state.characters.get(CEO_ID)
      if (ceoCh) {
        ceoCh.isPlayerControlled = true
        ceoCh.state = CharacterState.IDLE
        ceoCh.isActive = false
        ceoCh.agentStatus = 'working'
      }
    }
    if (CEO_ID !== null) {
      state.cameraFollowId = CEO_ID
    }
    stateRef.current = state
    ;(window as any).__officeState = state
    loadAllAssets()
    onTilesetReady(() => {
      state.rebuildFurnitureInstances()
    })
  }, [agents, CEO_ID])

  // Sync agent statuses from props (debounced inside OfficeState)
  // Skip player-controlled CEO
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    for (const agent of agents) {
      if (agent.isPlayer) continue
      const status = agentStatuses[agent.agentName] ?? 'offline'
      state.setAgentStatus(agent.id, status)
    }
  }, [agentStatuses])

  // Sync session context info (task name, tool name)
  useEffect(() => {
    const state = stateRef.current
    if (!state || !agentSessionInfos) return
    for (const agent of agents) {
      const info = agentSessionInfos[agent.agentName]
      if (info) {
        state.setAgentSessionInfo(agent.id, info)
      }
    }
  }, [agentSessionInfos])

  // Sync busy map (multi-session indicator)
  useEffect(() => {
    const state = stateRef.current
    if (!state || !agentBusyMap) return
    for (const agent of agents) {
      state.setAgentBusy(agent.id, agentBusyMap[agent.agentName] ?? false)
    }
  }, [agentBusyMap])

  // Sync subagent-by-parent map (for meeting room routing)
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    const idMap = new Map<number, number[]>()
    if (subagentsByParent) {
      for (const [parentName, childNames] of subagentsByParent) {
        const parentId = AGENT_NAME_TO_ID.get(parentName)
        if (parentId === undefined) continue
        const childIds: number[] = []
        for (const childName of childNames) {
          const childId = AGENT_NAME_TO_ID.get(childName)
          if (childId !== undefined) childIds.push(childId)
        }
        if (childIds.length > 0) idMap.set(parentId, childIds)
      }
    }
    if (typeof state.setSubagentsByParent === 'function') {
      state.setSubagentsByParent(idMap)
    }
  }, [subagentsByParent])

  // Sync review interactions (reviewer walks to builder's desk)
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    // Convert agentName-based map to id-based map
    const idPairs = new Map<number, number>()
    if (reviewInteractions) {
      for (const [reviewerName, builderName] of reviewInteractions) {
        const reviewerId = AGENT_NAME_TO_ID.get(reviewerName)
        const builderId = AGENT_NAME_TO_ID.get(builderName)
        if (reviewerId !== undefined && builderId !== undefined) {
          idPairs.set(reviewerId, builderId)
        }
      }
    }
    if (typeof state.setReviewPairs === 'function') {
      state.setReviewPairs(idPairs)
    }
  }, [reviewInteractions])

  // Sync selected agent
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    if (selectedAgentName) {
      const agent = agents.find((a) => a.agentName === selectedAgentName)
      state.selectedAgentId = agent ? agent.id : null
    } else {
      state.selectedAgentId = null
    }
  }, [selectedAgentName])

  // WASD/Arrow keyboard input on window — held-key tracking for continuous movement
  useEffect(() => {
    if (CEO_ID === null) return

    const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

    const shouldIgnore = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (!MOVE_KEYS.has(key)) return
      if (shouldIgnore()) return
      e.preventDefault()
      const state = stateRef.current
      if (!state) return
      state.heldKeys.add(key)
      // If CEO is idle with no path, immediately start moving in the pressed direction
      const ceo = state.characters.get(CEO_ID!)
      if (ceo && ceo.isPlayerControlled && ceo.state === CharacterState.IDLE && ceo.path.length === 0) {
        let dc = 0
        let dr = 0
        switch (key) {
          case 'w': case 'arrowup':    dr = -1; break
          case 's': case 'arrowdown':  dr = 1;  break
          case 'a': case 'arrowleft':  dc = -1; break
          case 'd': case 'arrowright': dc = 1;  break
        }
        const targetCol = ceo.tileCol + dc
        const targetRow = ceo.tileRow + dr
        let moved = state.walkToTile(CEO_ID!, targetCol, targetRow)
        // If blocked (e.g. surrounded by desk furniture), stand up then retry
        if (!moved && state.standUpFromSeat(CEO_ID!)) {
          // After teleport, try walking in the pressed direction from the new position
          const newTarget = { col: ceo.tileCol + dc, row: ceo.tileRow + dr }
          state.walkToTile(CEO_ID!, newTarget.col, newTarget.row)
        }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (!MOVE_KEYS.has(key)) return
      const state = stateRef.current
      if (state) state.heldKeys.delete(key)
    }

    const onBlur = () => {
      const state = stateRef.current
      if (state) state.heldKeys.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onBlur)
    }
  }, [CEO_ID])

  // Escape key handler for deselection (on window, not canvas)
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const state = stateRef.current
      if (!state) return
      state.selectedAgentId = null
      if (propsRef.current.onAgentClick) propsRef.current.onAgentClick('')
      if (propsRef.current.onItemClick) propsRef.current.onItemClick(null)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [])

  // ResizeObserver — track container width to compute fitZoom
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const parent = wrapper.parentElement
    if (!parent) return

    const observer = new ResizeObserver(() => {
      const w = parent.clientWidth
      if (w === 0) return

      const state = stateRef.current
      if (state) {
        const cols = state.tileMap[0]?.length ?? 1
        const newFitZoom = w / (cols * TILE_SIZE)
        setFitZoom(newFitZoom)
        // If user hasn't manually zoomed yet, track fitZoom
        // We detect "hasn't zoomed" by checking if current zoom equals old fitZoom
        setZoom((prevZoom) => {
          // On first load or if zoom was tracking fitZoom, update to new fitZoom
          const oldFitZoom = fitZoomRef.current
          if (Math.abs(prevZoom - oldFitZoom) < 0.01) {
            return newFitZoom
          }
          return prevZoom
        })
      }
    })

    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  // Keep a ref of fitZoom for the resize observer closure
  const fitZoomRef = useRef(fitZoom)
  fitZoomRef.current = fitZoom

  // Wheel zoom handler
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const parent = wrapper.parentElement
    if (!parent) return

    const onWheel = (e: WheelEvent) => {
      // Only zoom if Ctrl/Meta is held, otherwise let native scroll work
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((prev) => {
        const minZoom = Math.max(MIN_ZOOM_ABSOLUTE, fitZoomRef.current * 0.5)
        const maxZoom = Math.min(MAX_ZOOM_ABSOLUTE, fitZoomRef.current * 3)
        return Math.max(minZoom, Math.min(maxZoom, prev + delta * prev))
      })
    }

    parent.addEventListener('wheel', onWheel, { passive: false })
    return () => parent.removeEventListener('wheel', onWheel)
  }, [])

  // Compute canvas pixel dimensions from zoom and map size
  const { cols, rows } = getMapDims()
  const canvasLogicalW = cols * TILE_SIZE * zoom
  const canvasLogicalH = rows * TILE_SIZE * zoom

  // Update canvas backing store when zoom/size changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.ceil(canvasLogicalW * dpr)
    canvas.height = Math.ceil(canvasLogicalH * dpr)
    canvas.style.width = `${Math.ceil(canvasLogicalW)}px`
    canvas.style.height = `${Math.ceil(canvasLogicalH)}px`
  }, [canvasLogicalW, canvasLogicalH])

  // Animation loop
  useEffect(() => {
    const loop = (time: number) => {
      const canvas = canvasRef.current
      const state = stateRef.current
      if (!canvas || !state) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const dt =
        lastTimeRef.current === 0
          ? 0
          : Math.min((time - lastTimeRef.current) / 1000, MAX_DELTA_TIME_SEC)
      lastTimeRef.current = time

      state.update(dt)

      // ── Camera follow: scroll parent container to keep CEO visible ──
      const currentZoom = zoomRef.current
      if (state.cameraFollowId !== null && dt > 0) {
        const followCh = state.characters.get(state.cameraFollowId)
        const scrollParent = wrapperRef.current?.parentElement
        if (followCh && scrollParent && followCh.state === CharacterState.WALK) {
          const ceoScreenX = followCh.x * currentZoom
          const ceoScreenY = followCh.y * currentZoom
          const vw = scrollParent.clientWidth
          const vh = scrollParent.clientHeight
          const sl = scrollParent.scrollLeft
          const st = scrollParent.scrollTop

          // Deadzone: center region where no scrolling happens
          const marginX = vw * CAMERA_DEADZONE_FRACTION
          const marginY = vh * CAMERA_DEADZONE_FRACTION
          const dzLeft = sl + marginX
          const dzRight = sl + vw - marginX
          const dzTop = st + marginY
          const dzBottom = st + vh - marginY

          let targetSL = sl
          let targetST = st
          if (ceoScreenX < dzLeft) targetSL = ceoScreenX - marginX
          else if (ceoScreenX > dzRight) targetSL = ceoScreenX - vw + marginX
          if (ceoScreenY < dzTop) targetST = ceoScreenY - marginY
          else if (ceoScreenY > dzBottom) targetST = ceoScreenY - vh + marginY

          if (targetSL !== sl || targetST !== st) {
            const lerpFactor = 1 - Math.pow(1 - CAMERA_FOLLOW_LERP, dt * 60)
            let newSL = sl + (targetSL - sl) * lerpFactor
            let newST = st + (targetST - st) * lerpFactor
            // Snap when close enough
            if (Math.abs(newSL - targetSL) < CAMERA_FOLLOW_SNAP_THRESHOLD) newSL = targetSL
            if (Math.abs(newST - targetST) < CAMERA_FOLLOW_SNAP_THRESHOLD) newST = targetST
            scrollParent.scrollLeft = newSL
            scrollParent.scrollTop = newST
          }
        }
      }

      const dpr = window.devicePixelRatio || 1
      const mapCols = state.tileMap[0]?.length ?? 1
      const mapRows = state.tileMap.length ?? 1
      const w = mapCols * TILE_SIZE * currentZoom
      const h = mapRows * TILE_SIZE * currentZoom

      const ctx = canvas.getContext('2d')!
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.imageSmoothingEnabled = false

      const selection: SelectionRenderState = {
        selectedAgentId: state.selectedAgentId,
        hoveredAgentId: state.hoveredAgentId,
        hoveredTile: state.hoveredTile,
        seats: state.seats,
        characters: state.characters,
        collisionFlash: state.collisionFlash,
      }

      const statuses = propsRef.current.agentStatuses
      const statusMap = new Map<number, import('./types').AgentStatus>()
      for (const [name, status] of Object.entries(statuses)) {
        const id = AGENT_NAME_TO_ID.get(name)
        if (id !== undefined) statusMap.set(id, status)
      }
      if (CEO_ID !== null) statusMap.set(CEO_ID, 'working')

      // Build task text map from character session info
      const taskTextMap = new Map<number, string>()
      const sessionInfos = propsRef.current.agentSessionInfos
      if (sessionInfos) {
        for (const [name, info] of Object.entries(sessionInfos)) {
          const text = info.taskName ?? formatActivity(info.toolName, info.detail)
          if (text) {
            const id = AGENT_NAME_TO_ID.get(name)
            if (id !== undefined) taskTextMap.set(id, text)
          }
        }
      }

      // Build interaction map from agent pairs (widened with type)
      const interactionMap = new Map<number, {partnerId: number, type: InteractionType}>()
      const interactions = propsRef.current.agentInteractions
      if (interactions) {
        for (const [a, b, type] of interactions) {
          const idA = AGENT_NAME_TO_ID.get(a)
          const idB = AGENT_NAME_TO_ID.get(b)
          if (idA !== undefined && idB !== undefined) {
            interactionMap.set(idA, {partnerId: idB, type})
            interactionMap.set(idB, {partnerId: idA, type})
          }
        }
      }

      const identity: IdentityOverlay = {
        nameMap: AGENT_ID_TO_NAME,
        statusMap,
        colorMap: AGENT_ID_TO_COLOR,
        taskTextMap,
        interactionMap,
        time: time / 1000,
      }

      // Override facing direction for interacting agents (face each other)
      const facingSaves: Array<{ ch: { dir: number }; dir: number }> = []
      if (interactionMap.size > 0) {
        const chars = state.getCharacters()
        const charById = new Map(chars.map(c => [c.id, c]))
        for (const [idA, {partnerId: idB}] of interactionMap) {
          const a = charById.get(idA)
          const b = charById.get(idB)
          if (a && b && a.state !== CharacterState.WALK) {
            facingSaves.push({ ch: a, dir: a.dir })
            // Face toward partner based on relative position
            const dx = b.x - a.x
            const dy = b.y - a.y
            if (Math.abs(dx) > Math.abs(dy)) {
              a.dir = dx > 0 ? Direction.RIGHT : Direction.LEFT
            } else {
              a.dir = dy > 0 ? Direction.DOWN : Direction.UP
            }
          }
        }
      }

      // Canvas = full map size, so panX/panY = 0, offsets will be 0
      renderFrame(
        ctx,
        w,
        h,
        state.tileMap,
        state.furniture,
        state.getCharacters(),
        currentZoom,
        0,
        0,
        selection,
        undefined,
        state.layout.tileColors,
        state.layout.cols,
        state.layout.rows,
        state.layout.gidLayers,
        identity,
      )

      // Restore original facing directions
      for (const save of facingSaves) {
        save.ch.dir = save.dir
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    // Background fallback: RAF pauses in hidden tabs, but state updates
    // (meeting detection, agent routing) should still tick. Use setInterval
    // which continues at ~1Hz in background tabs.
    const bgTimer = setInterval(() => {
      if (!document.hidden) return // RAF handles visible tabs
      const state = stateRef.current
      if (state) state.update(1 / 4) // simulate ~4fps worth of progress
    }, 250)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(bgTimer)
    }
  }, [agents])

  // Initial scroll-to-CEO on mount so the player character is visible
  useEffect(() => {
    if (CEO_ID === null) return
    // Delay slightly to allow canvas dimensions to settle
    const timer = requestAnimationFrame(() => {
      const state = stateRef.current
      const scrollParent = wrapperRef.current?.parentElement
      if (!state || !scrollParent) return
      const ceo = state.characters.get(CEO_ID!)
      if (!ceo) return
      const currentZoom = zoomRef.current
      const ceoScreenX = ceo.x * currentZoom
      const ceoScreenY = ceo.y * currentZoom
      // Center CEO in viewport
      scrollParent.scrollLeft = ceoScreenX - scrollParent.clientWidth / 2
      scrollParent.scrollTop = ceoScreenY - scrollParent.clientHeight / 2
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  // Convert screen coords to world coords (offsets are 0 since canvas = map)
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const currentZoom = zoomRef.current
    return {
      worldX: screenX / currentZoom,
      worldY: screenY / currentZoom,
    }
  }, [])

  // Resolve character id -> display name ("You" for CEO)
  const resolveAgentName = useCallback((charId: number): string => {
    return AGENT_ID_TO_NAME.get(charId) ?? ''
  }, [])

  // Resolve character id -> real agent name (for data lookups, never "You")
  const resolveRealAgentName = useCallback((charId: number): string => {
    return AGENT_ID_TO_REAL_NAME.get(charId) ?? ''
  }, [])

  // ---------------------------------------------------------------------------
  // Click handler: process a click at world coordinates.
  // Priority: agent > furniture/desk > click-to-move (CEO)
  // ---------------------------------------------------------------------------
  const processClick = useCallback(
    (worldX: number, worldY: number) => {
      const state = stateRef.current
      if (!state) return

      // 1. Agent hit (highest priority)
      const charId = state.getCharacterAt(worldX, worldY)
      if (charId !== null) {
        state.selectedAgentId = charId === state.selectedAgentId ? null : charId
        const name = resolveAgentName(charId)
        if (name && propsRef.current.onAgentClick) {
          propsRef.current.onAgentClick(name)
        }
        return
      }

      // 2. Interactive furniture hit — only intercept specific interactive items,
      //    not generic furniture (which would block click-to-move on dense maps)
      const tileInfo = state.getTileInfoAt(worldX, worldY)
      const isInteractiveItem = tileInfo && (
        (tileInfo.type === 'desk' && tileInfo.agentId !== undefined) ||
        tileInfo.type === 'server' ||
        tileInfo.type === 'conference' ||
        tileInfo.type === 'whiteboard' ||
        tileInfo.type === 'bookshelf'
      )
      if (isInteractiveItem) {
        state.selectedAgentId = null
        let agentName: string | undefined
        if (tileInfo.type === 'desk' && tileInfo.agentId !== undefined) {
          agentName = resolveRealAgentName(tileInfo.agentId)
        }
        const item: ClickedItem = {
          type: tileInfo.type,
          col: tileInfo.col,
          row: tileInfo.row,
          agentName,
        }
        if (propsRef.current.onItemClick) {
          propsRef.current.onItemClick(item)
        }
        return
      }

      // 3. Click-to-move CEO — walk to clicked tile, or nearest walkable neighbor
      if (CEO_ID !== null) {
        const tileCol = Math.floor(worldX / TILE_SIZE)
        const tileRow = Math.floor(worldY / TILE_SIZE)

        // If CEO is stuck at seat (surrounded by blocked tiles), stand up first
        const ceo = state.characters.get(CEO_ID)
        if (ceo && ceo.state !== CharacterState.WALK) {
          state.standUpFromSeat(CEO_ID)
        }

        let moved = state.walkToTile(CEO_ID, tileCol, tileRow)
        // If target isn't walkable, try adjacent tiles (nearest walkable neighbor)
        if (!moved) {
          const offsets = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
          ]
          for (const [dc, dr] of offsets) {
            moved = state.walkToTile(CEO_ID, tileCol + dc, tileRow + dr)
            if (moved) break
          }
        }
      }
    },
    [resolveAgentName, resolveRealAgentName],
  )

  // Keep processClick in a ref for touch handler closure
  const processClickRef = useRef(processClick)
  processClickRef.current = processClick

  // Mouse handlers (no drag/pan -- click and hover only)
  const handleMouseDown = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    // no-op: click is handled on mouseUp
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const state = stateRef.current
      if (!state) return

      const screenX = e.nativeEvent.offsetX
      const screenY = e.nativeEvent.offsetY
      const { worldX, worldY } = screenToWorld(screenX, screenY)
      const charId = state.getCharacterAt(worldX, worldY)
      state.hoveredAgentId = charId

      // Check furniture for pointer cursor
      const tileInfo = charId === null ? state.getTileInfoAt(worldX, worldY) : null
      const isInteractive = charId !== null || (tileInfo !== null && tileInfo.type !== 'wall')

      if (canvasRef.current) {
        canvasRef.current.style.cursor = isInteractive ? 'pointer' : 'default'
      }

      // Room hover tooltip: only show when not hovering agent or interactive furniture
      if (charId === null && !isInteractive) {
        const col = Math.floor(worldX / TILE_SIZE)
        const row = Math.floor(worldY / TILE_SIZE)
        const zoneId = getZoneAt(col, row)
        if (zoneId) {
          const zone = ROOM_ZONES[zoneId]
          const agentsInZone = state.getAgentsInZone(
            zone.bounds.minCol, zone.bounds.minRow,
            zone.bounds.maxCol, zone.bounds.maxRow,
          )
          const agentNames = agentsInZone
            .map((a) => AGENT_ID_TO_NAME.get(a.id) ?? '')
            .filter((n) => n !== '')
          setTooltip({
            x: screenX + 12,
            y: screenY - 8,
            roomName: zone.label,
            agents: agentNames,
          })
        } else {
          setTooltip(null)
        }
      } else {
        setTooltip(null)
      }
    },
    [screenToWorld],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { worldX, worldY } = screenToWorld(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
      processClick(worldX, worldY)
    },
    [screenToWorld, processClick],
  )

  const handleMouseLeave = useCallback(() => {
    const state = stateRef.current
    if (state) state.hoveredAgentId = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
    setTooltip(null)
  }, [])

  // Touch handlers (tap-to-click only, no drag/pan or pinch-to-zoom)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function touchOffset(t: Touch) {
      const rect = canvas!.getBoundingClientRect()
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }

    let touchStart: { x: number; y: number } | null = null

    function onTouchStart(e: TouchEvent) {
      // Don't preventDefault -- allow native scroll on touch
      if (e.touches.length === 1) {
        touchStart = touchOffset(e.touches[0])
      }
    }

    function onTouchMove(e: TouchEvent) {
      // If finger moves too far, cancel the tap (let browser scroll)
      if (touchStart && e.touches.length === 1) {
        const pos = touchOffset(e.touches[0])
        const dx = pos.x - touchStart.x
        const dy = pos.y - touchStart.y
        if (Math.sqrt(dx * dx + dy * dy) >= 10) {
          touchStart = null
        }
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length === 0 && touchStart) {
        const currentZoom = zoomRef.current
        const worldX = touchStart.x / currentZoom
        const worldY = touchStart.y / currentZoom
        processClickRef.current(worldX, worldY)
      }
      touchStart = null
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={{
        width: Math.ceil(canvasLogicalW),
        height: Math.ceil(canvasLogicalH),
      }}
    >
      <canvas
        ref={canvasRef}
        className="block touch-none outline-none"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        aria-label="Office simulation"
        role="img"
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-black/80 text-white text-xs px-3 py-2 rounded-lg shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y, maxWidth: 200 }}
          role="tooltip"
        >
          <div className="font-semibold mb-0.5">{tooltip.roomName}</div>
          {tooltip.agents.length > 0 ? (
            <div className="text-white/70">
              {tooltip.agents.join(', ')}
            </div>
          ) : (
            <div className="text-white/50 italic">Empty</div>
          )}
        </div>
      )}
    </div>
  )
}
