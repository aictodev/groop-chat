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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MODEL_PROVIDER_MAP = {
  'google/gemini-2.5-flash': 'google',
  'openai/gpt-4o-mini': 'openai',
  'anthropic/claude-3.5-sonnet': 'anthropic',
  'meta-llama/llama-3-8b-instruct': 'meta',
  'deepseek/deepseek-chat': 'deepseek',
  'qwen/qwen-2.5-7b-instruct': 'qwen',
  'moonshotai/kimi-k2': 'moonshot',
  'x-ai/grok-4.1-fast:free': 'xai',
};

const MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude" },
  { id: "meta-llama/llama-3-8b-instruct", name: "Llama" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
  { id: "qwen/qwen-2.5-7b-instruct", name: "Qwen" },
  { id: "moonshotai/kimi-k2", name: "Kimi K2" },
  { id: "x-ai/grok-4.1-fast:free", name: "Grok" },
];

const BADGE_SIZES = {
  sm: {
    dimensions: 'h-5 w-5',
    text: 'text-[10px]',
  },
  md: {
    dimensions: 'h-6 w-6',
    text: 'text-[11px]',
  },
};

const SortableModelItem = ({ modelId, index, renderModelBadge, getModelConfig, toggleModel }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: modelId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative',
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-all border-transparent bg-whatsapp-accent-soft/70 hover:border-whatsapp-accent`}
    >
      <div className="flex flex-1 items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 -ml-1 hover:bg-black/5 rounded"
        >
          <GripVertical className="h-4 w-4 text-whatsapp-ink-subtle" />
        </div>
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
  );
};

// Separate component for the drag overlay to keep it clean
const DragOverlayItem = ({ modelId, renderModelBadge, getModelConfig }) => {
  return (
    <div className="flex items-center justify-between rounded-xl border border-whatsapp-accent bg-white px-3 py-2 shadow-xl cursor-grabbing opacity-90 scale-105">
      <div className="flex flex-1 items-center gap-2">
        <div className="p-1 -ml-1">
          <GripVertical className="h-4 w-4 text-whatsapp-ink-subtle" />
        </div>
        {renderModelBadge(modelId)}
        <span className="text-sm font-medium text-whatsapp-ink">
          {getModelConfig(modelId).name}
        </span>
      </div>
    </div>
  );
};

const ModelManager = ({ selectedModels, setSelectedModels, disabled }) => {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag (prevents accidental clicks)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = selectedModels.indexOf(active.id);
      const newIndex = selectedModels.indexOf(over.id);
      setSelectedModels(arrayMove(selectedModels, oldIndex, newIndex));
    }
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
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

  const renderModelBadge = (modelId, size = 'sm') => {
    const { icon, name, provider } = getModelConfig(modelId);
    const initial = name.charAt(0).toUpperCase();
    const sizeConfig = BADGE_SIZES[size] || BADGE_SIZES.sm;
    const { dimensions, text } = sizeConfig;

    return (
      <div
        className={`relative flex items-center justify-center ${dimensions}`}
      >
        {icon ? (
          <>
            <img
              src={icon}
              alt={`${provider || name} logo`}
              className={`${dimensions} rounded-full border border-white/60 bg-white object-contain shadow-sm`}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback) {
                  fallback.classList.remove('hidden');
                  fallback.classList.add('flex');
                }
              }}
            />
            <div
              className={`hidden ${dimensions} items-center justify-center rounded-full bg-whatsapp-accent-soft ${text} font-semibold text-whatsapp-ink`}
            >
              {initial}
            </div>
          </>
        ) : (
          <div
            className={`flex ${dimensions} items-center justify-center rounded-full bg-whatsapp-accent-soft ${text} font-semibold text-whatsapp-ink`}
          >
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
          {selectedModels.length > 0 && (
            <div className="flex items-center justify-center">
              {renderModelBadge(selectedModels[0], 'md')}
            </div>
          )}
          <Menu className="h-4 w-4" />
          <span className="text-sm font-semibold text-whatsapp-ink-soft">
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={selectedModels}
              strategy={verticalListSortingStrategy}
            >
              {selectedModels.map((modelId, index) => (
                <SortableModelItem
                  key={modelId}
                  modelId={modelId}
                  index={index}
                  renderModelBadge={renderModelBadge}
                  getModelConfig={getModelConfig}
                  toggleModel={toggleModel}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <DragOverlayItem
                  modelId={activeId}
                  renderModelBadge={renderModelBadge}
                  getModelConfig={getModelConfig}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
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
