import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Check, Copy } from 'lucide-react';

const MarkdownRenderer = ({ content }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="markdown-body text-sm"
        components={{
            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
            li: ({ node, ...props }) => <li className="pl-1" {...props} />,
            code: ({ node, inline, className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                return !inline ? (
                    <div className="relative group my-2 rounded bg-black/10 border border-black/5">
                        <pre className="p-2 overflow-x-auto text-xs font-mono bg-transparent m-0">
                            <code className={className} {...props}>{children}</code>
                        </pre>
                    </div>
                ) : (
                    <code className="px-1 py-0.5 rounded bg-black/5 font-mono text-[0.9em]" {...props}>{children}</code>
                );
            },
        }}
    >
        {content}
    </ReactMarkdown>
);

const CouncilMessage = ({ msg }) => {
    const [activeTab, setActiveTab] = useState('synthesis'); // 'synthesis', 'responses', 'rankings'
    const [expandedRankings, setExpandedRankings] = useState({});

    const { stages } = msg;
    const stage1 = stages?.[1] || {};
    const stage2 = stages?.[2] || {};
    const stage3 = stages?.[3] || {};

    const isStage1Loading = stage1.status === 'loading';
    const isStage2Loading = stage2.status === 'loading';
    const isStage3Loading = stage3.status === 'loading';

    const toggleRanking = (model) => {
        setExpandedRankings(prev => ({
            ...prev,
            [model]: !prev[model]
        }));
    };

    // Determine which tab to show by default if synthesis is not ready
    React.useEffect(() => {
        if (!stage3.response && stage1.results?.length > 0 && activeTab === 'synthesis') {
            setActiveTab('responses');
        } else if (stage3.response && activeTab !== 'synthesis') {
            setActiveTab('synthesis');
        }
    }, [stage3.response, stage1.results?.length]);

    return (
        <div className="chat-message chat-message--incoming w-full max-w-4xl bg-white rounded-lg shadow-sm border border-whatsapp-divider overflow-hidden">
            {/* Header */}
            <div className="bg-[#f0f2f5] px-4 py-3 border-b border-whatsapp-divider flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                        LC
                    </div>
                    <div>
                        <h3 className="font-semibold text-whatsapp-ink text-sm">LLM Council</h3>
                        <p className="text-xs text-whatsapp-ink-subtle">
                            {isStage3Loading ? 'Chairman is synthesizing...' :
                                isStage2Loading ? 'Council is deliberating...' :
                                    isStage1Loading ? 'Collecting opinions...' : 'Session adjourned'}
                        </p>
                    </div>
                </div>
                {/* Tabs */}
                <div className="flex bg-white rounded-lg p-1 border border-whatsapp-divider">
                    <button
                        onClick={() => setActiveTab('responses')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                            activeTab === 'responses' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        1. Opinions ({stage1.results?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('rankings')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                            activeTab === 'rankings' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        2. Review
                    </button>
                    <button
                        onClick={() => setActiveTab('synthesis')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                            activeTab === 'synthesis' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        3. Verdict
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-0 min-h-[200px]">
                {activeTab === 'responses' && (
                    <div className="divide-y divide-whatsapp-divider">
                        {stage1.results?.map((result, idx) => (
                            <div key={idx} className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                        {result.model}
                                    </span>
                                    {stage2.labelToModel && (
                                        <span className="text-xs text-gray-400">
                                            (Response {String.fromCharCode(65 + idx)})
                                        </span>
                                    )}
                                </div>
                                <div className="prose prose-sm max-w-none text-whatsapp-ink">
                                    <MarkdownRenderer content={result.response} />
                                </div>
                            </div>
                        ))}
                        {isStage1Loading && (
                            <div className="p-4 text-center text-gray-500 text-sm italic">
                                Waiting for models to respond...
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'rankings' && (
                    <div className="divide-y divide-whatsapp-divider">
                        {stage2.rankings?.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                {isStage2Loading ? 'Models are reviewing each other...' : 'No rankings available yet.'}
                            </div>
                        )}
                        {stage2.rankings?.map((ranking, idx) => (
                            <div key={idx} className="bg-white">
                                <button
                                    onClick={() => toggleRanking(ranking.model)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        {expandedRankings[ranking.model] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <span className="font-semibold text-sm text-whatsapp-ink">{ranking.model}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">View Critique</span>
                                </button>
                                {expandedRankings[ranking.model] && (
                                    <div className="px-4 pb-4 pl-8 bg-gray-50/50 border-t border-gray-100">
                                        <div className="pt-3 prose prose-sm max-w-none text-whatsapp-ink-soft">
                                            <MarkdownRenderer content={ranking.ranking} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'synthesis' && (
                    <div className="p-6 bg-indigo-50/30 min-h-[300px]">
                        {stage3.response ? (
                            <>
                                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-100">
                                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs">
                                        C
                                    </div>
                                    <span className="font-semibold text-indigo-900 text-sm">Chairman's Final Verdict</span>
                                </div>
                                <div className="prose prose-sm max-w-none text-whatsapp-ink">
                                    <MarkdownRenderer content={stage3.response} />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 animate-pulse">
                                    <span className="text-2xl">⚖️</span>
                                </div>
                                <h4 className="font-medium text-gray-900">Council is in session</h4>
                                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                                    {isStage1Loading ? 'Gathering initial opinions...' :
                                        isStage2Loading ? 'Debating and reviewing...' :
                                            'Synthesizing final verdict...'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CouncilMessage;
