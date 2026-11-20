import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";

import {
  DotsIcon,
  LockedIcon,
  UnlockedIcon,
} from "@excalidraw/excalidraw/components/icons";
import { PenModeButton } from "@excalidraw/excalidraw/components/PenModeButton";
import { t } from "@excalidraw/excalidraw/i18n";

import "./spaced.css";

import type { ToolbarMeta, ToolbarProps, ToolbarTool } from "../types";

export const meta: ToolbarMeta = {
  name: "Spaced",
  idea: "44px targets with no dead gaps, tools in clearly spaced groups, and a bold keyboard focus ring.",
};

type ToolType = ToolbarTool["type"];

const GROUPS: { label: string; types: ToolType[] }[] = [
  { label: "Navigate", types: ["hand", "selection"] },
  {
    label: "Shapes and lines",
    types: ["rectangle", "diamond", "ellipse", "arrow", "line"],
  },
  { label: "Draw and write", types: ["freedraw", "text", "stickynote", "eraser"] },
];

// tools whose icon fills in while active, as on Excalidraw's toolbar
const FILLABLE = new Set<ToolType>([
  "selection",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
]);

const ToolButton = ({
  tool,
  app,
  showKey,
  hintFrom = tool,
}: {
  tool: ToolbarTool;
  app: ToolbarProps["app"];
  showKey: boolean;
  /** whose shortcut to show: lasso borrows selection's when it's preferred */
  hintFrom?: ToolbarTool;
}) => {
  const pointerType = useRef<string | null>(null);
  const { shortcut, keyHint } = hintFrom;

  return (
    <button
      type="button"
      className={clsx("toolbar-spaced__btn", {
        "is-fillable": FILLABLE.has(tool.type),
      })}
      aria-label={tool.label}
      aria-pressed={tool.active}
      aria-keyshortcuts={shortcut ?? undefined}
      title={shortcut ? `${tool.label} · ${shortcut}` : tool.label}
      data-testid={`toolbar-${tool.type}`}
      disabled={tool.disabled}
      onPointerDown={(event) => {
        pointerType.current = event.pointerType || null;
        // a draggable tool (the sticky note) can be dragged onto the canvas
        app.toolDrag.handleButtonPointerDown(tool.type, event.nativeEvent);
      }}
      onClick={(event) => {
        if (pointerType.current === "pen" && !app.state.penDetected) {
          app.togglePenMode(true);
        }
        pointerType.current = null;
        // like Excalidraw: clicking the active selection tool again picks lasso
        if (tool.type === "selection" && tool.active && event.detail > 0) {
          app.setActiveTool({ type: "lasso" });
          return;
        }
        tool.select();
      }}
    >
      <span className="toolbar-spaced__icon" aria-hidden="true">
        {tool.icon}
      </span>
      {showKey && keyHint && (
        <span className="toolbar-spaced__key" aria-hidden="true">
          {keyHint}
        </span>
      )}
    </button>
  );
};

const MoreTools = ({
  tools,
  app,
  activeTool,
  lassoIsPreferred,
}: {
  tools: ToolbarTool[];
  app: ToolbarProps["app"];
  activeTool: ToolbarProps["activeTool"];
  lassoIsPreferred: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const label = t("toolBar.extraTools");
  // when lasso is the preferred selection tool it shows in the selection slot
  const activeMore = tools.find(
    (tool) => tool.active && !(tool.type === "lasso" && lassoIsPreferred),
  );

  const getItems = () =>
    Array.from(
      wrapRef.current?.querySelectorAll<HTMLButtonElement>(
        "[role=menuitemradio]:not(:disabled)",
      ) ?? [],
    );

  // a tool picked any other way (a shortcut, say) closes the menu
  useEffect(() => {
    setIsOpen(false);
  }, [activeTool]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const items = getItems();
    (items.find((item) => item.getAttribute("aria-checked") === "true") ||
      items[0])?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const doc = app.ownerDocument;
    doc.addEventListener("pointerdown", onPointerDown, true);
    return () => doc.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, app]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    const items = getItems();
    const index = items.indexOf(
      app.ownerDocument.activeElement as HTMLButtonElement,
    );
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
        ? (index - 1 + items.length) % items.length
        : event.key === "Home"
        ? 0
        : event.key === "End"
        ? items.length - 1
        : null;
    if (next !== null) {
      // keep arrows from also nudging selected shapes on the canvas
      event.preventDefault();
      event.stopPropagation();
      items[next]?.focus();
    }
  };

  return (
    <div className="toolbar-spaced__more" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="toolbar-spaced__btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        data-selected={activeMore ? "true" : undefined}
        title={activeMore ? `${label} · ${activeMore.label}` : label}
        data-testid="toolbar-more"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(true);
          }
        }}
      >
        <span className="toolbar-spaced__icon" aria-hidden="true">
          {activeMore ? activeMore.icon : DotsIcon}
        </span>
      </button>
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="toolbar-spaced__menu"
          onKeyDown={onMenuKeyDown}
        >
          {tools.map((tool) => (
            <button
              key={tool.type}
              type="button"
              role="menuitemradio"
              aria-checked={tool === activeMore}
              className="toolbar-spaced__item"
              data-testid={`toolbar-${tool.type}`}
              disabled={tool.disabled}
              onClick={() => {
                tool.select();
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span className="toolbar-spaced__item-icon" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="toolbar-spaced__item-label">{tool.label}</span>
              {tool.shortcut && (
                <span className="toolbar-spaced__item-key">{tool.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SpacedToolbar({
  tools,
  activeTool,
  locked,
  toggleLock,
  formFactor,
  renderHint,
  app,
  appState,
}: ToolbarProps) {
  const byType = new Map(tools.map((tool) => [tool.type, tool]));
  const isTouch = formFactor !== "desktop";
  const showKeys = !isTouch && !appState.zenModeEnabled;
  const lassoIsPreferred = appState.preferredSelectionTool.type === "lasso";
  const canLock = app.props.activeTool == null;
  const lockLabel = t("toolBar.lock");
  const selection = byType.get("selection");

  return (
    <div
      className={clsx("toolbar-spaced", {
        "toolbar-spaced--touch": isTouch,
        "toolbar-spaced--zen": appState.zenModeEnabled,
      })}
      data-viewport-ui="top"
    >
      {renderHint()}
      <div className="toolbar-spaced__bar">
        {canLock && (
          <div className="toolbar-spaced__group" role="group" aria-label="Tool options">
            {!isTouch && appState.penDetected && (
              <PenModeButton
                checked={appState.penMode}
                onChange={() => app.togglePenMode(null)}
                title={t("toolBar.penMode")}
                penDetected={appState.penDetected}
              />
            )}
            <button
              type="button"
              className="toolbar-spaced__btn"
              aria-label={lockLabel}
              aria-pressed={locked}
              aria-keyshortcuts="Q"
              title={`${lockLabel} · Q`}
              data-testid="toolbar-lock"
              onClick={() => toggleLock()}
            >
              <span className="toolbar-spaced__icon" aria-hidden="true">
                {locked ? LockedIcon : UnlockedIcon}
              </span>
              {showKeys && (
                <span className="toolbar-spaced__key" aria-hidden="true">
                  Q
                </span>
              )}
            </button>
          </div>
        )}
        {GROUPS.map((group) => (
          <div
            key={group.label}
            className="toolbar-spaced__group"
            role="group"
            aria-label={group.label}
          >
            {group.types.map((type) => {
              const tool =
                type === "selection" && lassoIsPreferred
                  ? byType.get("lasso")
                  : byType.get(type);
              return (
                tool && (
                  <ToolButton
                    key={type}
                    tool={tool}
                    app={app}
                    showKey={showKeys}
                    hintFrom={type === "selection" ? selection : tool}
                  />
                )
              );
            })}
          </div>
        ))}
        <div className="toolbar-spaced__group" role="group" aria-label="More">
          <MoreTools
            tools={tools.filter((tool) => tool.group === "more")}
            app={app}
            activeTool={activeTool}
            lassoIsPreferred={lassoIsPreferred}
          />
        </div>
      </div>
    </div>
  );
}
