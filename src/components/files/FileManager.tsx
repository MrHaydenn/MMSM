import React, { useState } from 'react';
import {
  Folder,
  File,
  FileCode,
  FileText,
  FileJson,
  Archive,
  Edit,
  Trash2,
  Download,
  Plus,
  Upload,
  Search,
  ChevronRight,
  Save,
  X,
  CheckCircle2,
  CornerDownRight,
  ArrowLeft,
  RefreshCw,
  FolderPlus,
  FilePlus,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { ServerFile } from '../../types/server';

export const FileManager: React.FC = () => {
  const { activeServer, saveFile, createFile, deleteFile, renameFile } = useServer();
  const { canPerformAction } = useAuth();

  const [currentDir, setCurrentDir] = useState<string>('/');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor state
  const [editingFile, setEditingFile] = useState<ServerFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New file / folder modals
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename modal
  const [renamingFile, setRenamingFile] = useState<ServerFile | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Delete modal
  const [deletingFile, setDeletingFile] = useState<ServerFile | null>(null);

  if (!activeServer) {
    return (
      <div className="p-8 text-center space-y-3">
        <Folder className="w-12 h-12 text-zinc-600 mx-auto" />
        <h2 className="text-base font-bold text-zinc-200">No Server Selected</h2>
        <p className="text-xs text-zinc-400">Please select or create a Minecraft server to manage its files.</p>
      </div>
    );
  }

  const files = activeServer.files || [];

  // Filter items in current directory
  const currentDirectoryFiles = files.filter((f) => {
    if (searchQuery.trim()) {
      return (
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.path.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (currentDir === '/') {
      // Top level items: path is like "/file.txt" or "/mods"
      const parts = f.path.split('/').filter(Boolean);
      return parts.length === 1;
    } else {
      // Nested items: path starts with currentDir and has exactly 1 more segment
      const prefix = `${currentDir}/`;
      if (!f.path.startsWith(prefix)) return false;
      const rest = f.path.substring(prefix.length);
      return !rest.includes('/');
    }
  });

  // Sort folders first, then files alphabetically
  const sortedFiles = [...currentDirectoryFiles].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  const breadcrumbs = currentDir === '/' ? ['/'] : ['/', ...currentDir.split('/').filter(Boolean)];

  const handleNavigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      setCurrentDir('/');
    } else {
      const parts = currentDir.split('/').filter(Boolean).slice(0, index);
      setCurrentDir(`/${parts.join('/')}`);
    }
  };

  const handleOpenFolder = (folder: ServerFile) => {
    setCurrentDir(folder.path);
    setSearchQuery('');
  };

  const handleOpenFileEditor = (file: ServerFile) => {
    setEditingFile(file);
    setEditorContent(file.content ?? '');
    setSaveSuccess(false);
  };

  const handleSaveEditor = () => {
    if (!editingFile) return;
    saveFile(activeServer.id, editingFile.path, editorContent);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const cleanName = newFileName.trim();
    const filePath = currentDir === '/' ? `/${cleanName}` : `${currentDir}/${cleanName}`;
    createFile(activeServer.id, filePath, false, '');
    setNewFileName('');
    setIsNewFileModalOpen(false);

    // Open in editor immediately
    const created = files.find((f) => f.path === filePath) || {
      id: `f-${Date.now()}`,
      name: cleanName,
      path: filePath,
      isDirectory: false,
      sizeBytes: 0,
      lastModified: new Date().toISOString(),
      content: '',
    };
    handleOpenFileEditor(created);
  };

  const handleCreateNewFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const cleanName = newFolderName.trim();
    const folderPath = currentDir === '/' ? `/${cleanName}` : `${currentDir}/${cleanName}`;
    createFile(activeServer.id, folderPath, true);
    setNewFolderName('');
    setIsNewFolderModalOpen(false);
  };

  const handleDownloadFile = (file: ServerFile) => {
    const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !renameInput.trim()) return;
    renameFile(activeServer.id, renamingFile.path, renameInput.trim());
    setRenamingFile(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingFile) return;
    deleteFile(activeServer.id, deletingFile.path);
    setDeletingFile(null);
  };

  const getFileIcon = (file: ServerFile) => {
    if (file.isDirectory) {
      return <Folder className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    const ext = file.extension?.toLowerCase() || '';
    if (['json'].includes(ext)) {
      return <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (['properties', 'cfg', 'conf', 'toml', 'yaml', 'yml'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (['log', 'txt'].includes(ext)) {
      return <FileText className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
    if (['jar', 'zip', 'gz', 'tar'].includes(ext)) {
      return <Archive className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Server File Manager & Config Editor</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Direct filesystem access for <strong className="text-zinc-200">{activeServer.name}</strong> · Saved in <code className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-emerald-400 font-mono text-[11px]">/Servers/{activeServer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/</code>
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Buttons */}
        {canPerformAction('edit_config') && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewFileModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>New File</span>
            </button>

            <button
              onClick={() => setIsNewFolderModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumb Path & Search Toolbar */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 font-mono">
          <button
            onClick={() => setCurrentDir('/')}
            className={`px-2 py-1 rounded hover:bg-zinc-800 transition-colors ${
              currentDir === '/' ? 'text-emerald-400 font-bold' : 'text-zinc-400'
            }`}
          >
            root
          </button>

          {currentDir !== '/' &&
            currentDir
              .split('/')
              .filter(Boolean)
              .map((part, index, array) => (
                <React.Fragment key={index}>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <button
                    onClick={() => {
                      const newPath = `/${array.slice(0, index + 1).join('/')}`;
                      setCurrentDir(newPath);
                    }}
                    className={`px-2 py-1 rounded hover:bg-zinc-800 transition-colors ${
                      index === array.length - 1
                        ? 'text-emerald-400 font-bold'
                        : 'text-zinc-400'
                    }`}
                  >
                    {part}
                  </button>
                </React.Fragment>
              ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files by name..."
            className="pl-8 pr-2.5 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 w-44 sm:w-60 font-mono"
          />
        </div>
      </div>

      {/* File List Table */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
          <div className="col-span-6 sm:col-span-5">Name</div>
          <div className="col-span-3 sm:col-span-3 text-right">Size</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Modified</div>
          <div className="col-span-3 sm:col-span-2 text-right">Actions</div>
        </div>

        {/* Up directory row */}
        {currentDir !== '/' && (
          <div
            onClick={() => {
              const parts = currentDir.split('/').filter(Boolean);
              parts.pop();
              setCurrentDir(parts.length === 0 ? '/' : `/${parts.join('/')}`);
            }}
            className="grid grid-cols-12 px-4 py-2.5 hover:bg-zinc-900/50 cursor-pointer border-b border-zinc-800/40 text-xs font-mono text-zinc-400 items-center"
          >
            <div className="col-span-12 flex items-center gap-2">
              <CornerDownRight className="w-4 h-4 text-zinc-500 rotate-180" />
              <span>.. (Parent Directory)</span>
            </div>
          </div>
        )}

        {sortedFiles.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            <p>This folder is currently empty.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 font-mono text-xs">
            {sortedFiles.map((file) => (
              <div
                key={file.id}
                className="grid grid-cols-12 px-4 py-2.5 hover:bg-zinc-900/40 transition-colors items-center group"
              >
                {/* Name */}
                <div className="col-span-6 sm:col-span-5 flex items-center gap-2.5 truncate pr-2">
                  {getFileIcon(file)}
                  {file.isDirectory ? (
                    <button
                      onClick={() => handleOpenFolder(file)}
                      className="font-medium text-zinc-200 hover:text-emerald-400 truncate text-left cursor-pointer"
                    >
                      {file.name}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenFileEditor(file)}
                      className="text-zinc-300 hover:text-emerald-400 truncate text-left cursor-pointer"
                    >
                      {file.name}
                    </button>
                  )}
                </div>

                {/* Size */}
                <div className="col-span-3 sm:col-span-3 text-right text-zinc-500 font-mono text-[11px]">
                  {file.isDirectory ? 'Directory' : formatFileSize(file.sizeBytes)}
                </div>

                {/* Modified */}
                <div className="hidden sm:block sm:col-span-2 text-right text-zinc-500 font-mono text-[11px]">
                  {file.lastModified.substring(0, 10)}
                </div>

                {/* Actions */}
                <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                  {!file.isDirectory && (
                    <button
                      onClick={() => handleOpenFileEditor(file)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Edit file"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!file.isDirectory && (
                    <button
                      onClick={() => handleDownloadFile(file)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canPerformAction('edit_config') && (
                    <button
                      onClick={() => {
                        setRenamingFile(file);
                        setRenameInput(file.name);
                      }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Rename"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canPerformAction('edit_config') && (
                    <button
                      onClick={() => setDeletingFile(file)}
                      className="p-1.5 rounded hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FILE EDITOR MODAL / DRAWER */}
      {editingFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5 font-mono text-xs">
                {getFileIcon(editingFile)}
                <span className="font-bold text-zinc-100">{editingFile.path}</span>
                <span className="text-[11px] text-zinc-500">
                  ({formatFileSize(new Blob([editorContent]).size)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Saved!
                  </span>
                )}

                {canPerformAction('edit_config') && (
                  <button
                    onClick={handleSaveEditor}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save File</span>
                  </button>
                )}

                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Textarea with Line numbers */}
            <div className="flex-1 bg-[#090c10] p-4 flex gap-4 overflow-hidden">
              <div className="hidden sm:block select-none text-zinc-600 font-mono text-xs text-right pr-2 border-r border-zinc-800/80 overflow-hidden leading-relaxed">
                {editorContent.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                readOnly={!canPerformAction('edit_config')}
                rows={30}
                className="flex-1 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none resize-none leading-relaxed overflow-y-auto selection:bg-emerald-500/30"
              />
            </div>

            {/* Footer */}
            <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Lines: {editorContent.split('\n').length}</span>
              <span>Encoding: UTF-8</span>
            </div>
          </div>
        </div>
      )}

      {/* NEW FILE MODAL */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewFile}
            className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-zinc-100 text-sm">Create New File</h3>
            <p className="text-xs text-zinc-400 font-mono">In directory: {currentDir}</p>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">File Name (including extension)</label>
              <input
                type="text"
                required
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. motd.txt, custom.properties, rules.json"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewFileModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Create File
              </button>
            </div>
          </form>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewFolder}
            className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-zinc-100 text-sm">Create New Folder</h3>
            <p className="text-xs text-zinc-400 font-mono">In directory: {currentDir}</p>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Folder Name</label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. plugins, schematics, scripts"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RENAME MODAL */}
      {renamingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRename}
            className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-zinc-100 text-sm">Rename Item</h3>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">New Name</label>
              <input
                type="text"
                required
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingFile(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE MODAL */}
      {deletingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-rose-400 text-sm">Delete {deletingFile.isDirectory ? 'Folder' : 'File'}?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to permanently delete <code className="text-zinc-200 font-mono">{deletingFile.path}</code>?
              {deletingFile.isDirectory && ' All nested files and subdirectories will also be removed.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFile(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
