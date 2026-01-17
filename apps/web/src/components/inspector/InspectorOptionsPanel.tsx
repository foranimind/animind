import type { Dispatch, RefObject, SetStateAction } from "react";
import { SelectMenu, type SelectOption } from "../ui/SelectMenu";
import type { AdvancedSettings, MoodOption, StyleOption } from "../../pages/create/types";

type InspectorOptionsPanelProps = {
  hasPrompt: boolean;
  isStarting: boolean;
  isJobActive: boolean;
  styleOptions: StyleOption[];
  moodOptions: MoodOption[];
  selectedStyle: string;
  selectedMood: string;
  duration: number;
  advancedOpen: boolean;
  advancedSettings: AdvancedSettings;
  modelOptions: SelectOption[];
  resolutionOptions: SelectOption[];
  onSelectStyle: (value: string) => void;
  onSelectMood: (value: string) => void;
  onDurationChange: (value: number) => void;
  onToggleAdvanced: () => void;
  onAdvancedSettingsChange: Dispatch<SetStateAction<AdvancedSettings>>;
  onAdjustSeed: (delta: number) => void;
  advancedToggleRef: RefObject<HTMLButtonElement>;
  advancedPanelRef: RefObject<HTMLDivElement>;
  onStartGeneration: () => void;
};

export const InspectorOptionsPanel = ({
  hasPrompt,
  isStarting,
  isJobActive,
  styleOptions,
  moodOptions,
  selectedStyle,
  selectedMood,
  duration,
  advancedOpen,
  advancedSettings,
  modelOptions,
  resolutionOptions,
  onSelectStyle,
  onSelectMood,
  onDurationChange,
  onToggleAdvanced,
  onAdvancedSettingsChange,
  onAdjustSeed,
  advancedToggleRef,
  advancedPanelRef,
  onStartGeneration,
}: InspectorOptionsPanelProps) => (
  <>
    {!hasPrompt && <div className="inspector-callout">发送提示词以解锁生成参数。</div>}
    <div className="inspector-section">
      <div className="inspector-section-title">风格</div>
      <div className="style-grid">
        {styleOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`style-card ${selectedStyle === option.id ? "active" : ""}`}
            onClick={() => onSelectStyle(option.id)}
          >
            <div className="style-card-title">{option.title}</div>
            <div className="style-card-description">{option.description}</div>
          </button>
        ))}
      </div>
    </div>

    <div className="inspector-section">
      <div className="inspector-section-title">情绪</div>
      <div className="mood-row">
        {moodOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`mood-chip ${selectedMood === option.id ? "active" : ""}`}
            onClick={() => onSelectMood(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="inspector-section">
      <div className="duration-row">
        <div className="inspector-section-title">时长</div>
        <div className="duration-value">{duration}s</div>
      </div>
      <input
        className="duration-slider"
        type="range"
        min={5}
        max={30}
        step={1}
        value={duration}
        onChange={(event) => onDurationChange(Number(event.target.value))}
      />
      <div className="duration-hint">片段越短，生成速度越快。</div>
    </div>

    <div className="inspector-section advanced-settings">
      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={advancedOpen}
        aria-controls="advanced-settings"
        onClick={onToggleAdvanced}
        ref={advancedToggleRef}
      >
        <span className="advanced-toggle-icon" aria-hidden="true" />
        <span className="advanced-toggle-label">高级设置</span>
      </button>
      {advancedOpen && (
        <div className="advanced-panel" id="advanced-settings" ref={advancedPanelRef}>
          <label className="field-row">
            <span>模型</span>
            <SelectMenu
              value={advancedSettings.model}
              options={modelOptions}
              ariaLabel="模型"
              onChange={(value) =>
                onAdvancedSettingsChange((prev) => ({
                  ...prev,
                  model: value,
                }))
              }
            />
          </label>
          <label className="field-row">
            <span>随机种子</span>
            <div className="seed-field">
              <input
                type="number"
                min={0}
                step={1}
                placeholder="自动"
                value={advancedSettings.seed}
                onChange={(event) =>
                  onAdvancedSettingsChange((prev) => ({
                    ...prev,
                    seed: event.target.value,
                  }))
                }
              />
              <div className="seed-stepper">
                <button
                  type="button"
                  className="seed-stepper-button"
                  onClick={() => onAdjustSeed(1)}
                  aria-label="增加随机种子"
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M3 7l3-3 3 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="seed-stepper-button"
                  onClick={() => onAdjustSeed(-1)}
                  aria-label="减少随机种子"
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M3 5l3 3 3-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </label>
          <label className="field-row">
            <span>分辨率</span>
            <SelectMenu
              value={advancedSettings.resolution}
              options={resolutionOptions}
              ariaLabel="分辨率"
              onChange={(value) =>
                onAdvancedSettingsChange((prev) => ({
                  ...prev,
                  resolution: value,
                }))
              }
            />
          </label>
        </div>
      )}
    </div>

    <button
      type="button"
      className="primary-button"
      disabled={!hasPrompt || isStarting || isJobActive}
      onClick={onStartGeneration}
    >
      <span>开始生成</span>
      <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M6 4l10 6-10 6z" fill="currentColor" />
      </svg>
    </button>
  </>
);
