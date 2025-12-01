import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
                return inline ? (
                    <code className="px-1 py-0.5 rounded bg-black/5 font-mono text-[0.9em]" {...props}>{children}</code>
                ) : (
                    <div className="relative group my-2 rounded bg-black/10 border border-black/5">
                        <pre className="p-2 overflow-x-auto text-xs font-mono bg-transparent m-0">
                            <code className={className} {...props}>{children}</code>
                        </pre>
                    </div>
                );
            },
        }}
    >
        {content}
    </ReactMarkdown>
);

const CouncilMessage = ({ msg }) => {
    const [showThoughts, setShowThoughts] = useState(false);
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

    return (
        <div className="chat-message chat-message--incoming w-full max-w-4xl bg-white rounded-lg shadow-sm border border-whatsapp-divider overflow-hidden">
            {/* Header */}
            <div className="bg-[#f0f2f5] px-4 py-3 border-b border-whatsapp-divider flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img
                        src="/karpathy-mode.png"
                        alt="Council"
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                        <h3 className="font-semibold text-whatsapp-ink text-sm">LLM Council</h3>
                        <p className="text-xs text-whatsapp-ink-subtle">
                            {isStage3Loading ? 'Chairman is synthesizing...' :
                                isStage2Loading ? 'Council is deliberating...' :
                                    isStage1Loading ? 'Collecting opinions...' : 'Session adjourned'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowThoughts((s) => !s)}
                    className="flex items-center gap-2 text-xs font-medium text-indigo-700 hover:text-indigo-800 bg-white rounded-md px-3 py-1.5 border border-indigo-100"
                >
                    {showThoughts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {showThoughts ? 'Hide council thoughts' : 'Show council thoughts'}
                </button>
            </div>

            {/* Content */}
            <div className="p-0 min-h-[200px]">
                <div className="p-6 bg-indigo-50/30 min-h-[200px]">
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
                        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-3 animate-pulse">
                                <span className="text-lg">⚖️</span>
                            </div>
                            <p className="text-sm text-gray-600">
                                {isStage1Loading ? 'Gathering initial opinions...' :
                                    isStage2Loading ? 'Debating and reviewing...' :
                                        'Synthesizing final verdict...'}
                            </p>
                        </div>
                    )}
                </div>

                {showThoughts && (
                    <div className="border-t border-whatsapp-divider bg-white">
                        <div className="p-4">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Stage 1 · Opinions</p>
                            <div className="divide-y divide-whatsapp-divider">
                                {stage1.results?.map((result, idx) => (
                                    <div key={idx} className="py-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                {result.model}
                                            </span>
                                            <span className="text-xs text-gray-400">Thought {idx + 1}</span>
                                        </div>
                                        <div className="prose prose-sm max-w-none text-whatsapp-ink">
                                            <MarkdownRenderer content={result.response} />
                                        </div>
                                    </div>
                                ))}
                                {isStage1Loading && (
                                    <div className="py-3 text-gray-500 text-sm italic">
                                        Waiting for models to respond...
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-whatsapp-divider">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Stage 2 · Peer Review</p>
                            {stage2.rankings?.length === 0 && (
                                <div className="text-sm text-gray-500">
                                    {isStage2Loading ? 'Models are reviewing each other...' : 'No rankings available yet.'}
                                </div>
                            )}
                            {stage2.rankings?.map((ranking, idx) => (
                                <div key={idx} className="bg-white">
                                    <button
                                        onClick={() => toggleRanking(ranking.model)}
                                        className="w-full flex items-center justify-between py-3 text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            {expandedRankings[ranking.model] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            <span className="font-semibold text-sm text-whatsapp-ink">{ranking.model}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">View critique</span>
                                    </button>
                                    {expandedRankings[ranking.model] && (
                                        <div className="pl-6 pb-3">
                                            <div className="prose prose-sm max-w-none text-whatsapp-ink-soft">
                                                <MarkdownRenderer content={ranking.ranking} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CouncilMessage;
