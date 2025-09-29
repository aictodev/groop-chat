import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, X, GripVertical } from 'lucide-react';

const MODEL_PROVIDER_MAP = {
  'google/gemini-2.5-flash': 'google',
  'openai/gpt-4o-mini': 'openai',
  'anthropic/claude-3.5-sonnet': 'anthropic',
  'meta-llama/llama-3-8b-instruct': 'meta',
  'deepseek/deepseek-chat': 'deepseek',
  'qwen/qwen-2.5-7b-instruct': 'qwen',
  'moonshotai/kimi-k2': 'moonshot',
};

const MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude" },
  { id: "meta-llama/llama-3-8b-instruct", name: "Llama" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
  { id: "qwen/qwen-2.5-7b-instruct", name: "Qwen" },
  { id: "moonshotai/kimi-k2", name: "Kimi K2" },
];

const ModelManager = ({ selectedModels, setSelectedModels, disabled }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const moveModel = (fromIndex, toIndex) => {
    const newOrder = [...selectedModels];
    const [movedModel] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedModel);
    setSelectedModels(newOrder);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveModel(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter((id) => id !== modelId));
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  const getModelConfig = (modelId) => {
    const model = MODELS.find((m) => m.id === modelId);
    const provider = MODEL_PROVIDER_MAP[modelId] || null;
    return {
      name: model?.name || modelId,
      provider,
      icon: provider ? `/icons/${provider}.svg` : null,
    };
  };

  const renderModelBadge = (modelId) => {
    const { icon, name, provider } = getModelConfig(modelId);
    const initial = name.charAt(0).toUpperCase();

    return (
      <div className="relative flex h-5 w-5 items-center justify-center">
        {icon ? (
          <>
            <img
              src={icon}
              alt={`${provider || name} logo`}
              className="h-5 w-5 rounded-full border border-white/60 bg-white object-contain shadow-sm"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            <div className="hidden h-5 w-5 items-center justify-center rounded-full bg-whatsapp-accent-soft text-[10px] font-semibold text-whatsapp-ink">
              {initial}
            </div>
          </>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-whatsapp-accent-soft text-[10px] font-semibold text-whatsapp-ink">
            {initial}
          </div>
        )}
      </div>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="whatsapp-secondary"
          size="sm"
          disabled={disabled}
          className="h-10 rounded-bubble px-3 shadow-none"
        >
          <Menu className="h-4 w-4" />
          <span className="ml-2 text-sm font-semibold text-whatsapp-ink-soft">
            {selectedModels.length}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-80 rounded-2xl border border-whatsapp-divider bg-white p-3 shadow-panel"
      >
        <div className="space-y-2">
          <div className="pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-whatsapp-ink-subtle">
              Active Models (in order)
            </p>
          </div>

          {selectedModels.map((modelId, index) => (
            <div
              key={modelId}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="flex items-center justify-between rounded-xl border border-transparent bg-whatsapp-accent-soft/70 px-3 py-2 transition-all hover:border-whatsapp-accent cursor-grab"
            >
              <div className="flex flex-1 items-center gap-2">
                <GripVertical className="h-4 w-4 text-whatsapp-ink-subtle" />
                {renderModelBadge(modelId)}
                <span className="text-sm font-medium text-whatsapp-ink">
                  {getModelConfig(modelId).name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-whatsapp-ink-subtle">
                <span className="font-medium">#{index + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleModel(modelId)}
                  className="h-7 w-7 rounded-full text-red-500 hover:bg-red-100"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {MODELS.filter((m) => !selectedModels.includes(m.id)).length > 0 && (
          <>
            <DropdownMenuSeparator className="my-3 bg-whatsapp-divider" />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-whatsapp-ink-subtle">
                Available Models
              </p>

              {MODELS.filter((m) => !selectedModels.includes(m.id)).map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-whatsapp-ink-soft focus:bg-whatsapp-panel-muted focus:text-whatsapp-ink"
                >
                  <span className="flex items-center gap-2">
                    {renderModelBadge(model.id)}
                    <span>{model.name}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-whatsapp-accent hover:bg-whatsapp-accent/10"
                  >
                    <span className="text-base font-bold">+</span>
                  </Button>
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModelManager;
