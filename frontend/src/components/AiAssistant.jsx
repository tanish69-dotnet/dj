import React, { useState } from 'react';
import { MessageSquare, Send, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { api } from '../services/api';

const suggestionChips = [
  "What resources are under pressure?",
  "Which allocations are at risk?",
  "Which routes are blocked?",
  "Where is demand highest?",
];

const AiAssistant = ({ dashboard, allocations }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      let contextStr = 'No context available.';
      if (dashboard) {
        contextStr = `Current Operations Context:
- Active Emergencies: ${dashboard.active_emergencies || 0}
- Resources Available: ${dashboard.resources_available || 0}
- Active Allocations: ${dashboard.active_allocations || 0}
- Pending Demand: ${dashboard.pending_demand || 0}
`;
      }
      
      if (allocations && allocations.length > 0) {
        contextStr += `\nRecent Allocations: ` + allocations.slice(0, 3).map(a => `${a.quantity}x ${a.resource_id} (${a.status})`).join(', ');
      }

      const fullMessage = `System Context:\n${contextStr}\n\nUser Question:\n${input}`;
      
      const res = await api.askAI(fullMessage);
      
      if (res.data && res.data.success) {
        setResponse(res.data.reply);
      } else {
        setError('Failed to get a response from AI Assistant.');
      }
    } catch (err) {
      console.error(err);
      setError('Error communicating with AI Assistant.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    setInput(suggestion);
    handleAskAI({ preventDefault: () => {} });
  };

  return (
    <div className="bg-[#101827] border border-[#1E2D42] rounded-xl p-4 flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A855F7] to-[#7C3AED] flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-white">AI OPERATIONS ASSISTANT</h2>
            <p className="text-[11px] text-[#10B981]">● READY</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[160px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-[#A855F7]" size={24} />
          </div>
        ) : error ? (
          <div className="text-[#EF4444] text-sm p-3 bg-[#EF4444]/10 rounded-lg">
            {error}
          </div>
        ) : response ? (
          <div className="whitespace-pre-wrap text-sm text-[#D1D5DB] leading-relaxed">{response}</div>
        ) : (
          <div className="h-full flex flex-col justify-center items-center text-center">
            <HelpCircle size={32} className="text-[#5A6E85] mb-3" />
            <p className="text-[#5A6E85] text-sm mb-4">Ask questions about the current disaster response situation.</p>
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