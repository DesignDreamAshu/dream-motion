import React, { useState } from 'react';
import selectIcon from '../assets/tool-select.svg';
import rectIcon from '../assets/tool-rect.svg';
import circleIcon from '../assets/tool-circle.svg';
import textIcon from '../assets/tool-text.svg';
import penIcon from '../assets/tool-pen.svg';
import imageIcon from '../assets/tool-image.svg';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import { Tooltip } from './ui/tooltip';

type TopBarProps = {
  previewMode: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onTogglePreview: () => void;
  onImportSvg: () => void;
  onImportImage: () => void;
  onExportRuntime: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onQueueRender: () => void;
  onPublish: () => void;
  collaborationEnabled: boolean;
  onToggleShare: () => void;
  webglEnabled: boolean;
  onToggleWebgl: () => void;
  onOpenTemplates: () => void;
  onOpenAssets: () => void;
  onOpenAdmin: () => void;
  onOpenBilling: () => void;
  activeTool: 'select' | 'rect' | 'ellipse' | 'text' | 'pen' | 'image';
  onSelectTool: (tool: 'select' | 'rect' | 'ellipse' | 'text' | 'pen' | 'image') => void;
  onNewFile: () => void;
};

export const TopBar: React.FC<TopBarProps> = ({
  previewMode,
  isPlaying,
  onPlay,
  onPause,
  onTogglePreview,
  onImportSvg,
  onImportImage,
  onExportRuntime,
  onExportPng,
  onExportSvg,
  onQueueRender,
  onPublish,
  collaborationEnabled,
  onToggleShare,
  webglEnabled,
  onToggleWebgl,
  onOpenTemplates,
  onOpenAssets,
  onOpenAdmin,
  onOpenBilling,
  activeTool,
  onSelectTool,
  onNewFile
}) => {
  const [ioOpen, setIoOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const isV1Disabled = true;
  return (
    <div className="topbar">
      <div className="toolbar-left">
        <Tooltip title="Create a new file" subtext="Shortcut: Cmd/Ctrl + N" tooltipFor="new-file">
          <Button className="menu-mini ToolbarButton" data-onboarding="new-file" onClick={onNewFile}>
            New file
          </Button>
        </Tooltip>
        <div className="tool-row">
          <Tooltip title="Select and move" subtext="Shortcut: V" tooltipFor="tool-select">
            <Button
              variant="icon"
              className={`${activeTool === 'select' ? 'is-active' : ''} ${previewMode ? 'is-disabled' : ''}`}
              data-tool="select"
              aria-pressed={activeTool === 'select'}
              aria-disabled={previewMode}
              disabled={previewMode}
              onClick={() => onSelectTool('select')}
            >
              <img src={selectIcon} alt="" />
            </Button>
          </Tooltip>
          <Tooltip title="Draw rectangle" subtext="Shortcut: R" tooltipFor="tool-rect">
            <Button
              variant="icon"
              className={`${activeTool === 'rect' ? 'is-active' : ''} ${previewMode ? 'is-disabled' : ''}`}
              data-tool="rect"
              data-onboarding="tool-rect"
              aria-pressed={activeTool === 'rect'}
              aria-disabled={previewMode}
              disabled={previewMode}
              onClick={() => onSelectTool('rect')}
            >
              <img src={rectIcon} alt="" />
            </Button>
          </Tooltip>
          <Tooltip title="Draw ellipse" subtext="Shortcut: O" tooltipFor="tool-ellipse">
            <Button
              variant="icon"
              className={`${activeTool === 'ellipse' ? 'is-active' : ''} ${previewMode ? 'is-disabled' : ''}`}
              data-tool="ellipse"
              aria-pressed={activeTool === 'ellipse'}
              aria-disabled={previewMode}
              disabled={previewMode}
              onClick={() => onSelectTool('ellipse')}
            >
              <img src={circleIcon} alt="" />
            </Button>
          </Tooltip>
          <Tooltip title="Insert text" subtext="Shortcut: T" tooltipFor="tool-text">
            <Button
              variant="icon"
              className={`${activeTool === 'text' ? 'is-active' : ''} ${previewMode ? 'is-disabled' : ''}`}
              data-tool="text"
              aria-pressed={activeTool === 'text'}
              aria-disabled={previewMode}
              disabled={previewMode}
              onClick={() => onSelectTool('text')}
            >
              <img src={textIcon} alt="" />
            </Button>
          </Tooltip>
          <Tooltip title="Draw vector path" subtext="Shortcut: P" tooltipFor="tool-pen">
            <Button
              variant="icon"
              className={`${activeTool === 'pen' ? 'is-active' : ''} ${previewMode ? 'is-disabled' : ''}`}
              data-tool="pen"
              aria-pressed={activeTool === 'pen'}
              aria-disabled={previewMode}
              disabled={previewMode}
              onClick={() => onSelectTool('pen')}
            >
              <img src={penIcon} alt="" />
            </Button>
          </Tooltip>
          <Tooltip title="Import image" subtext="Shortcut: I" tooltipFor="tool-image">
            <Button
              variant="icon"
              className={`${activeTool === 'image' ? 'is-active' : ''} ${previewMode ? 'is-disabled' : ''}`}
              data-tool="image"
              aria-pressed={activeTool === 'image'}
              aria-disabled={previewMode}
              disabled={previewMode}
              onClick={() => onSelectTool('image')}
            >
              <img src={imageIcon} alt="" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="actions">
        <div className="menu-group">
          <DropdownMenu open={ioOpen} onOpenChange={setIoOpen}>
            <Tooltip title="Import assets or export animation" tooltipFor="import-export">
              <DropdownMenuTrigger>
                <Button
                  variant="toolbar"
                  data-feature="import-export"
                  data-onboarding="import-export"
                >
                  Import / Export
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onImportSvg}>Import SVG</DropdownMenuItem>
              <DropdownMenuItem onSelect={onImportImage}>Import Image</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onExportPng}>Export PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportSvg}>Export SVG (Selected)</DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportRuntime}>Export Runtime</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onQueueRender}>Queue Render</DropdownMenuItem>
              <DropdownMenuItem onSelect={onPublish}>Publish Preview</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="menu-group">
          <DropdownMenu open={libraryOpen} onOpenChange={setLibraryOpen}>
            <Tooltip title="Available in V2" tooltipFor="library">
              <DropdownMenuTrigger>
                <Button
                  variant="toolbar"
                  className={isV1Disabled ? 'is-disabled' : ''}
                  data-feature="library"
                  aria-disabled={isV1Disabled}
                  disabled={isV1Disabled}
                >
                  Library
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onOpenTemplates}>Templates</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenAssets}>Asset Library</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Tooltip title="Preview final animation" subtext="Disables editing" tooltipFor="preview">
          <Button
            variant="toolbar"
            className={previewMode ? 'is-active' : ''}
            data-feature="preview"
            data-onboarding="preview"
            onClick={onTogglePreview}
          >
            {previewMode ? 'Design Mode' : 'Preview Mode'}
          </Button>
        </Tooltip>
        <Tooltip title="Play animation" subtext="Shortcut: Space (Preview Mode)" tooltipFor="play">
          <Button
            variant="toolbar"
            className={isPlaying ? 'is-active' : ''}
            data-feature="play"
            data-onboarding="play"
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
        </Tooltip>
        <Tooltip title="Available in V2" tooltipFor="share">
          <Button
            variant="toolbar"
            className={isV1Disabled ? 'is-disabled' : ''}
            data-feature="share"
            aria-disabled={isV1Disabled}
            disabled={isV1Disabled}
            onClick={onToggleShare}
          >
            {collaborationEnabled ? 'Sharing' : 'Share'}
          </Button>
        </Tooltip>
        <Tooltip title="Admin settings (V5)" tooltipFor="admin">
          <Button
            variant="toolbar"
            className={isV1Disabled ? 'is-disabled' : ''}
            data-feature="admin"
            aria-disabled={isV1Disabled}
            disabled={isV1Disabled}
            onClick={onOpenAdmin}
          >
            Admin
          </Button>
        </Tooltip>
        <Tooltip title="Billing & plans (V5)" tooltipFor="billing">
          <Button
            variant="toolbar"
            className={isV1Disabled ? 'is-disabled' : ''}
            data-feature="billing"
            aria-disabled={isV1Disabled}
            disabled={isV1Disabled}
            onClick={onOpenBilling}
          >
            Billing
          </Button>
        </Tooltip>
        <Tooltip title="WebGL renderer (V2)" tooltipFor="webgl">
          <Button
            variant="toolbar"
            className={isV1Disabled ? 'is-disabled' : ''}
            data-feature="webgl"
            aria-disabled={isV1Disabled}
            disabled={isV1Disabled}
            onClick={onToggleWebgl}
          >
            WebGL
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
