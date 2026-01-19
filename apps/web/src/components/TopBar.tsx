import React, { useMemo, useState } from 'react';
import selectIcon from '../assets/Cursor.svg';
import frameIcon from '../assets/tool-frame.svg';
import rectIcon from '../assets/tool-rect.svg';
import circleIcon from '../assets/tool-circle.svg';
import lineIcon from '../assets/tool-line.svg';
import textIcon from '../assets/tool-text.svg';
import penIcon from '../assets/pen-tool.svg';
import pencilIcon from '../assets/tool-pencil.svg';
import imageIcon from '../assets/tool-image.svg';
import connectorIcon from '../assets/tool-connector.svg';
import arrowDownIcon from '../assets/Arrow Down.svg';
import playIcon from '../assets/Play.svg';
import settingsIcon from '../assets/Settings.svg';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import { Tooltip } from './ui/tooltip';

type ToolId =
  | 'select'
  | 'frame'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'pen'
  | 'pencil'
  | 'image'
  | 'connector';

type TopBarProps = {
  playMode: boolean;
  isPlaying: boolean;
  fileName: string;
  isStarred: boolean;
  onRenameFile: () => void;
  onDuplicateFile: () => void;
  onMoveFile: () => void;
  onToggleStar: () => void;
  onOpenVersionHistory: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenFile: () => void;
  onExportDmx: () => void;
  onPlay: () => void;
  onPlayFromStart: () => void;
  onPause: () => void;
  onImportSvg: () => void;
  onExportRuntime: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  collaborationEnabled: boolean;
  onToggleShare: () => void;
  webglEnabled: boolean;
  onToggleWebgl: () => void;
  onOpenTemplates: () => void;
  onOpenAssets: () => void;
  onOpenAdmin: () => void;
  onOpenBilling: () => void;
  onOpenPreferences: () => void;
  onOpenShortcuts: () => void;
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  onNewFile: () => void;
  onRenameFileInline: (name: string) => void;
  playbackLoop: boolean;
  playbackSpeed: number;
  onToggleLoop: () => void;
  onSetPlaybackSpeed: (speed: number) => void;
};

const toolIcons: Record<ToolId, string> = {
  select: selectIcon,
  frame: frameIcon,
  rect: rectIcon,
  ellipse: circleIcon,
  line: lineIcon,
  text: textIcon,
  pen: penIcon,
  pencil: pencilIcon,
  image: imageIcon,
  connector: connectorIcon
};

const shortcutFor = (tool: ToolId) => {
  switch (tool) {
    case 'select':
      return 'V';
    case 'frame':
      return 'F';
    case 'rect':
      return 'R';
    case 'ellipse':
      return 'O';
    case 'line':
      return 'L';
    case 'text':
      return 'T';
    case 'pen':
      return 'P';
    case 'pencil':
      return 'Shift + P';
    case 'image':
      return 'I';
    case 'connector':
      return 'C';
    default:
      return '';
  }
};

const HeaderBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="topbar header-bar">{children}</div>
);

const FileMenu: React.FC<{
  isStarred: boolean;
  onRenameFile: () => void;
  onDuplicateFile: () => void;
  onMoveFile: () => void;
  onToggleStar: () => void;
  onOpenVersionHistory: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenFile: () => void;
  onExportDmx: () => void;
  onImportSvg: () => void;
  onExportRuntime: () => void;
  onNewFile: () => void;
}> = ({
  isStarred,
  onRenameFile,
  onDuplicateFile,
  onMoveFile,
  onToggleStar,
  onOpenVersionHistory,
  onSave,
  onSaveAs,
  onOpenFile,
  onExportDmx,
  onImportSvg,
  onExportRuntime,
  onNewFile
}) => (
  <div className="header-left">
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="icon" className="logo-button" aria-label="App menu">
          DM
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onNewFile}>New File</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenFile}>Open...</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSave}>Save</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSaveAs}>Save As...</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="toolbar" className="file-menu-button is-text">
          <span className="file-menu-label">File</span>
          <img className="caret-icon file-name-caret" src={arrowDownIcon} alt="" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onNewFile}>New Project</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenFile}>Open...</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSave}>Save</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSaveAs}>Save As...</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onImportSvg}>Import...</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onExportRuntime}>Export Runtime</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportDmx}>Export .dmx</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRenameFile}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicateFile}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onSelect={onMoveFile}>Move to...</DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleStar}>{isStarred ? 'Unstar' : 'Star'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenVersionHistory}>Version history</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

const ToolToolbar: React.FC<{
  activeTool: ToolId;
  playMode: boolean;
  onSelectTool: (tool: ToolId) => void;
}> = ({ activeTool, playMode, onSelectTool }) => {
  const shapeTool = useMemo<ToolId>(() => {
    if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'line') {
      return activeTool;
    }
    return 'rect';
  }, [activeTool]);
  const penTool = useMemo<ToolId>(() => {
    if (activeTool === 'pen' || activeTool === 'pencil') return activeTool;
    return 'pen';
  }, [activeTool]);

  return (
    <div className="tool-toolbar">
      <div className="tool-group">
        <Tooltip title="Select and move" subtext={`Shortcut: ${shortcutFor('select')}`} tooltipFor="tool-select">
          <Button
            variant="icon"
            className={`${activeTool === 'select' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
            data-tool="select"
            aria-pressed={activeTool === 'select'}
            aria-disabled={playMode}
            disabled={playMode}
            onClick={() => onSelectTool('select')}
          >
            <img src={toolIcons.select} alt="" />
          </Button>
        </Tooltip>
        <Tooltip title="Frame tool" subtext={`Shortcut: ${shortcutFor('frame')}`} tooltipFor="tool-frame">
          <Button
            variant="icon"
            className={`${activeTool === 'frame' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
            data-tool="frame"
            aria-pressed={activeTool === 'frame'}
            aria-disabled={playMode}
            disabled={playMode}
            onClick={() => onSelectTool('frame')}
          >
            <img src={toolIcons.frame} alt="" />
          </Button>
        </Tooltip>
        <Tooltip title="Connector" subtext={`Shortcut: ${shortcutFor('connector')}`} tooltipFor="tool-connector">
          <Button
            variant="icon"
            className={`${activeTool === 'connector' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
            data-tool="connector"
            aria-pressed={activeTool === 'connector'}
            aria-disabled={playMode}
            disabled={playMode}
            onClick={() => onSelectTool('connector')}
          >
            <img src={toolIcons.connector} alt="" />
          </Button>
        </Tooltip>
      </div>
      <div className="tool-group tools-extended">
        <DropdownMenu>
          <Tooltip title="Shape tools" subtext="Rectangle / Ellipse / Line" tooltipFor="tool-shape">
            <DropdownMenuTrigger>
              <Button
                variant="icon"
                className={`with-caret no-outline ${activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'line' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
                data-tool={shapeTool}
                aria-pressed={activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'line'}
                aria-disabled={playMode}
                disabled={playMode}
              >
                <img src={toolIcons[shapeTool]} alt="" />
                <img className="caret-icon tool-caret" src={arrowDownIcon} alt="" />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onSelectTool('rect')}>Rectangle (R)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('ellipse')}>Ellipse (O)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('line')}>Line (L)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip title="Insert text" subtext={`Shortcut: ${shortcutFor('text')}`} tooltipFor="tool-text">
          <Button
            variant="icon"
            className={`${activeTool === 'text' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
            data-tool="text"
            aria-pressed={activeTool === 'text'}
            aria-disabled={playMode}
            disabled={playMode}
            onClick={() => onSelectTool('text')}
          >
            <img src={toolIcons.text} alt="" />
          </Button>
        </Tooltip>
        <DropdownMenu>
          <Tooltip title="Pen tools" subtext="Pen / Pencil" tooltipFor="tool-pen">
            <DropdownMenuTrigger>
              <Button
                variant="icon"
                className={`with-caret ${activeTool === 'pen' || activeTool === 'pencil' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
                data-tool={penTool}
                aria-pressed={activeTool === 'pen' || activeTool === 'pencil'}
                aria-disabled={playMode}
                disabled={playMode}
              >
                <img src={toolIcons[penTool]} alt="" />
                <img className="caret-icon tool-caret" src={arrowDownIcon} alt="" />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onSelectTool('pen')}>Pen (P)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('pencil')}>Pencil (Shift + P)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip title="Import image" subtext={`Shortcut: ${shortcutFor('image')}`} tooltipFor="tool-image">
          <Button
            variant="icon"
            className={`${activeTool === 'image' ? 'is-active' : ''} ${playMode ? 'is-disabled' : ''}`}
            data-tool="image"
            aria-pressed={activeTool === 'image'}
            aria-disabled={playMode}
            disabled={playMode}
            onClick={() => onSelectTool('image')}
          >
            <img src={toolIcons.image} alt="" />
          </Button>
        </Tooltip>
      </div>
      <div className="tool-group tools-overflow">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="toolbar" className="toolbar-compact">
              <span className="toolbar-label">Tools</span>
              <img className="caret-icon toolbar-caret" src={arrowDownIcon} alt="" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onSelectTool('rect')}>Rectangle (R)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('ellipse')}>Ellipse (O)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('line')}>Line (L)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('text')}>Text (T)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('pen')}>Pen (P)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('pencil')}>Pencil (Shift + P)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool('image')}>Image (I)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const PlaybackControl: React.FC<{
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPlayFromStart: () => void;
  playbackLoop: boolean;
  playbackSpeed: number;
  onToggleLoop: () => void;
  onSetPlaybackSpeed: (speed: number) => void;
}> = ({
  isPlaying,
  onPlay,
  onPause,
  onPlayFromStart,
  playbackLoop,
  playbackSpeed,
  onToggleLoop,
  onSetPlaybackSpeed
}) => (
  <div className="playback-group">
    <Tooltip title="Play" subtext="Space to play/pause" tooltipFor="play">
      <Button
        variant="icon"
        className={`no-outline ${isPlaying ? 'is-active' : ''}`}
        data-feature="play"
        onClick={isPlaying ? onPause : onPlay}
      >
        {isPlaying ? '||' : <img src={playIcon} alt="" />}
      </Button>
    </Tooltip>
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="icon" className="playback-menu no-outline" aria-label="Playback options">
          <img className="caret-icon toolbar-caret" src={arrowDownIcon} alt="" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onPlayFromStart}>Play from start</DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleLoop}>{playbackLoop ? 'Loop: On' : 'Loop: Off'}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {[0.5, 1, 2].map((speed) => (
          <DropdownMenuItem key={speed} onSelect={() => onSetPlaybackSpeed(speed)}>
            {speed}x {playbackSpeed === speed ? '*' : ''}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

const ResourcesMenu: React.FC<{
  onOpenAssets: () => void;
  onOpenTemplates: () => void;
}> = ({ onOpenAssets, onOpenTemplates }) => (
  <DropdownMenu>
    <Tooltip title="Library and templates" tooltipFor="resources">
      <DropdownMenuTrigger>
        <Button variant="toolbar" className="toolbar-compact" data-feature="import-export">
          <span className="toolbar-icon">...</span>
          <span className="toolbar-label">Resources</span>
          <img className="caret-icon toolbar-caret" src={arrowDownIcon} alt="" />
        </Button>
      </DropdownMenuTrigger>
    </Tooltip>
    <DropdownMenuContent>
      <DropdownMenuItem onSelect={onOpenAssets} data-feature="library">Library</DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpenTemplates}>Templates</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const WorkspaceMenu: React.FC<{
  onOpenAdmin: () => void;
  onOpenBilling: () => void;
  onToggleWebgl: () => void;
  onOpenPreferences: () => void;
  onOpenShortcuts: () => void;
  webglEnabled: boolean;
}> = ({
  onOpenAdmin,
  onOpenBilling,
  onToggleWebgl,
  onOpenPreferences,
  onOpenShortcuts,
  webglEnabled
}) => {
  const isV1Disabled = true;
  return (
    <DropdownMenu>
      <Tooltip title="Workspace settings" tooltipFor="workspace">
        <DropdownMenuTrigger>
          <Button variant="toolbar" className="toolbar-compact" data-feature="workspace">
            <img className="toolbar-icon" src={settingsIcon} alt="" />
            <img className="caret-icon toolbar-caret" src={arrowDownIcon} alt="" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onOpenAdmin} disabled={isV1Disabled} data-feature="admin">
          Admin
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenBilling} disabled={isV1Disabled} data-feature="billing">
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleWebgl} disabled={isV1Disabled} data-feature="webgl">
          WebGL {webglEnabled ? 'On' : 'Off'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenPreferences}>Preferences</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenShortcuts}>Keyboard shortcuts</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const TopBar: React.FC<TopBarProps> = (props) => (
  <HeaderBar>
    <FileMenu
      isStarred={props.isStarred}
      onRenameFile={props.onRenameFile}
      onDuplicateFile={props.onDuplicateFile}
      onMoveFile={props.onMoveFile}
      onToggleStar={props.onToggleStar}
      onOpenVersionHistory={props.onOpenVersionHistory}
      onSave={props.onSave}
      onSaveAs={props.onSaveAs}
      onOpenFile={props.onOpenFile}
      onExportDmx={props.onExportDmx}
      onImportSvg={props.onImportSvg}
      onExportRuntime={props.onExportRuntime}
      onNewFile={props.onNewFile}
    />
    <div className="header-left">
      <ToolToolbar
        activeTool={props.activeTool}
        playMode={props.playMode}
        onSelectTool={props.onSelectTool}
      />
    </div>
    <div className="header-center">
      <ProjectTitle fileName={props.fileName} onRename={props.onRenameFileInline} />
    </div>
    <div className="header-right">
      <PlaybackControl
        isPlaying={props.isPlaying}
        onPlay={props.onPlay}
        onPause={props.onPause}
        onPlayFromStart={props.onPlayFromStart}
        playbackLoop={props.playbackLoop}
        playbackSpeed={props.playbackSpeed}
        onToggleLoop={props.onToggleLoop}
        onSetPlaybackSpeed={props.onSetPlaybackSpeed}
      />
      <Tooltip title="Available in V2" tooltipFor="share">
        <Button
          variant="toolbar"
          className="ToolbarButton is-primary is-disabled"
          data-feature="share"
          aria-disabled
          disabled
          onClick={props.onToggleShare}
        >
          <span className="share-icon">S</span>
          <span className="share-label">{props.collaborationEnabled ? 'Sharing' : 'Share'}</span>
        </Button>
      </Tooltip>
      <ResourcesMenu
        onOpenAssets={props.onOpenAssets}
        onOpenTemplates={props.onOpenTemplates}
      />
      <WorkspaceMenu
        onOpenAdmin={props.onOpenAdmin}
        onOpenBilling={props.onOpenBilling}
        onToggleWebgl={props.onToggleWebgl}
        onOpenPreferences={props.onOpenPreferences}
        onOpenShortcuts={props.onOpenShortcuts}
        webglEnabled={props.webglEnabled}
      />
    </div>
  </HeaderBar>
);

const ProjectTitle: React.FC<{ fileName: string; onRename: (name: string) => void }> = ({
  fileName,
  onRename
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fileName);
  const commit = () => {
    const next = value.trim();
    if (next) onRename(next);
    setEditing(false);
  };
  return (
    <div className="project-title">
      {editing ? (
        <input
          className="project-title-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
              setValue(fileName);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="project-title-button"
          onClick={() => {
            setValue(fileName);
            setEditing(true);
          }}
        >
          {fileName}
        </button>
      )}
    </div>
  );
};
