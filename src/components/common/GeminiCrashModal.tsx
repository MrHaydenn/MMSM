import React, { useState, useEffect } from 'react';
import { Sparkles, X, Copy, Check, ExternalLink, RefreshCw, AlertTriangle, Cpu, Terminal, ShieldAlert } from 'lucide-react';
import { MinecraftServer, ServerLog } from '../../types/server';

interface GeminiCrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: MinecraftServer;
  logs: ServerLog[];
}

export const GeminiCrashModal: React.FC<GeminiCrashModalProps> = ({
  isOpen,
  onClose,
  server,
  logs,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const crashLogsText = logs
    .slice(-30)
    .map((l) => `[${l.timestamp}] [${l.thread}/${l.level}]: ${l.message}`)
    .join('\n');

  const fullPromptForGeminiWeb = `You are a Minecraft server sysadmin. Analyze this Minecraft server crash log and provide a fix:

Server Name: ${server.name}
Loader: ${server.loader}
Minecraft Version: ${server.minecraftVersion}

Crash Output:
${crashLogsText || 'No log output captured'}`;

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch('/api/gemini/analyze-crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName: server.name,
          loader: server.loader,
          minecraftVersion: server.minecraftVersion,
          crashSnippet: crashLogsText,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Could not analyze automatically. You can copy the prompt and query Gemini directly below.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reach Gemini API backend.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAnalysis();
    }
  }, [isOpen, server.id]);

  if (!isOpen) return null;

  const handleCopyPromptAndOpenWeb = () => {
    navigator.clipboard.writeText(fullPromptForGeminiWeb);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
    window.open('https://gemini.google.com/app', '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-purple-500/40 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-[#151922] to-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Ask Gemini AI Crash Troubleshooter</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                AI diagnosis for {server.name} ({server.loader.toUpperCase()} {server.minecraftVersion})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Status Loading */}
          {isAnalyzing && (
            <div className="p-8 rounded-xl bg-purple-950/20 border border-purple-800/40 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-purple-200">Analyzing Crash Stack Trace with Gemini...</h3>
                <p className="text-xs text-zinc-400 max-w-md">
                  Checking Java class versions, Fabric/Paper bundler compatibility, and mod dependencies...
                </p>
              </div>
            </div>
          )}

          {/* AI Analysis Result */}
          {!isAnalyzing && analysis && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900/90 border border-purple-500/30 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-bold text-xs text-purple-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Gemini AI Diagnosis & Recommended Fixes</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">Live AI Output</span>
                </div>

                <div className="prose prose-invert prose-xs max-w-none text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {analysis}
                </div>
              </div>
            </div>
          )}

          {/* Error / Fallback */}
          {!isAnalyzing && error && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 space-y-2 text-rose-200">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Notice: {error}</span>
              </div>
              <p className="text-xs text-zinc-300">
                You can copy the pre-formatted crash log prompt below and open Google Gemini directly in your browser.
              </p>
            </div>
          )}

          {/* Log Snippet Preview */}
          <div className="space-y-2">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Crash Log Output Passed to Gemini:</span>
            </span>
            <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
              {crashLogsText || 'No crash logs captured yet.'}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-[#151922] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>Re-Analyze Crash</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyPromptAndOpenWeb}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-950/50 cursor-pointer transition-all"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-300" /> : <ExternalLink className="w-4 h-4" />}
              <span>{copiedText ? 'Copied! Opening Gemini...' : 'Copy Error & Open in Google Gemini'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
