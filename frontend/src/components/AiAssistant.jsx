import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Loader2, Sparkles, HelpCircle, AlertTriangle, WifiOff } from 'lucide-react';
import { api } from '../services/api';

const suggestionChips = [
  "What resources are under pressure?",
  "Which allocations are at risk?",
  "Which routes are blocked?",
  "Where is demand highest?",
];

const AiAssistant = ({ city }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [provider, setProvider] = useState(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  const scope = !city || city === 'INDIA' ? 'INDIA (national)' : city;

  useEffect(() => () => { mounted.current = false; }, []);

  // Provider capability probe: lets the panel state whether answers come from
  // the configured model or from the deterministic database advisor.
  useEffect(() => {
    let active = true;
    api.getAIStatus(city)
      .then((res) => { if (active) setProvider(res.data); })
      .catch(() => { if (active) setProvider(null); });
    return () => { active = false; };
  }, [city]);

  const handleAskAI = async (e, questionOverride) => {
    e?.preventDefault?.();
    const question = (questionOverride ?? input).trim();
    if (!question) return;
    if (questionOverride !== undefined) setInput(questionOverride);

    const id = ++requestId.current;
    setIsLoading(true);
    setError('');
    setResponse('');
    setMeta(null);

    try {
      // Only the question is sent: the backend resolves authoritative state from
      // the database for the requested city scope, so no stale client-side
      // context is injected into the answer.
      const res = await api.askAI(question, city);

      // Ignore responses that arrive after a newer question was sent.
      if (!mounted.current || id !== requestId.current) return;

      if (res.data && res.data.success && typeof res.data.reply === 'string') {
        setResponse(res.data.reply);
        setMeta({
          source: res.data.source,
          degraded: Boolean(res.data.degraded),
          model: res.data.model || null,
          reason: res.data.reason || null,
          scope: res.data.scope || scope,
          missingEnv: res.data.missing_env || [],
        });
        setProvider((prev) => (prev ? { ...prev, configured: res.data.source === 'gemini', degraded: Boolean(res.data.degraded), mode: res.data.degraded ? 'deterministic' : 'ai' } : prev));
      } else {
        setError('The assistant returned an unexpected response. Please retry.');
      }
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      console.error(err);
      const detail = err?.response?.data?.detail;
      setError(detail
        ? `Assistant request failed: ${detail}`
        : 'Cannot reach the assistant API. Check that the backend is running and try again.');
    } finally {
      if (mounted.current && id === requestId.current) setIsLoading(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    handleAskAI(null, suggestion);
  };

  const providerMode = provider?.mode || (provider ? 'deterministic' : null);

  return (
    <div className="bg-[#101827] border border-[#1E2D42] rounded-xl p-4 flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A855F7] to-[#7C3AED] flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-white">AI OPERATIONS ASSISTANT</h2>
            {providerMode === 'ai' ? (
              <p className="text-[11px] text-[#10B981]">● READY — {provider?.model || 'model'}</p>
            ) : providerMode === 'deterministic' ? (
              <p className="text-[11px] text-[#F59E0B]">● DEGRADED — DATA ADVISOR</p>
            ) : (
              <p className="text-[11px] text-[#5A6E85]">● CHECKING PROVIDER…</p>
            )}
          </div>
        </div>
        <span className="text-[10px] text-[#5A6E85] border border-[#1E2D42] rounded-full px-2 py-1 whitespace-nowrap">
          SCOPE: {scope}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[160px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-2 text-[#8B9CB3] text-sm">
            <Loader2 className="animate-spin text-[#A855F7]" size={20} />
            <span>Querying operational records…</span>
          </div>
        ) : error ? (
          <div className="text-[#EF4444] text-sm p-3 bg-[#EF4444]/10 rounded-lg flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : response ? (
          <>
            {meta?.degraded && (
              <div className="text-[#F59E0B] text-[11px] bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-2 flex gap-2">
                <WifiOff size={14} className="shrink-0 mt-0.5" />
                <span>
                  Answer computed from live operational records, not the AI model.
                  {meta.missingEnv?.length ? ` Missing server env: ${meta.missingEnv.join(', ')}.` : ''}
                </span>
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm text-[#D1D5DB] leading-relaxed">{response}</div>
            <div className="text-[10px] text-[#5A6E85] flex items-center gap-1">
              <MessageSquare size={11} />
              SOURCE: {meta?.source === 'gemini' ? `GEMINI (${meta.model})` : 'DETERMINISTIC OPS ADVISOR'} · SCOPE: {meta?.scope || scope}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col justify-center items-center text-center">
            <HelpCircle size={32} className="text-[#5A6E85] mb-3" />
            <p className="text-[#5A6E85] text-sm mb-4">Ask questions about the current disaster response situation in {scope}.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestionChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(chip)}
                  className="px-3 py-1.5 text-[11px] text-[#8B9CB3] bg-[#151F30] border border-[#1E2D42] rounded-full hover:border-[#00D4FF]/50 hover:text-white transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleAskAI} className="flex gap-2 pt-3 border-t border-[#1E2D42]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="E.g., Which resources are under pressure?"
          className="flex-1 bg-[#070B14] border border-[#1E2D42] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00D4FF] placeholder-[#5A6E85]"
          disabled={isLoading}
          aria-label="Ask AI assistant"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-gradient-to-r from-[#A855F7] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 flex items-center justify-center transition-all"
          aria-label="Send question"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default AiAssistant;