import {
  EXPORT_PRESETS,
  MODEL_OPTIONS,
  MOOD_OPTIONS,
  RESOLUTION_PRESETS,
  STYLE_OPTIONS,
} from "../../lib/sessionDefaults";
import type { SessionOptions } from "../../lib/storage";
import { SurfacePanel } from "../ui/SurfacePanel";

type CreateSettingsPanelProps = {
  options: SessionOptions;
  onStyleChange: (value: string) => void;
  onMoodChange: (value: string) => void;
  onDurationChange: (value: number) => void;
};

const findLabel = (
  items: Array<{ id?: string; value?: string | readonly [number, number]; label?: string; title?: string }>,
  value: string
) =>
  items.find((item) => item.id === value || item.value === value)?.label ??
  items.find((item) => item.id === value || item.value === value)?.title ??
  value;

export const CreateSettingsPanel = ({
  options,
  onStyleChange,
  onMoodChange,
  onDurationChange,
}: CreateSettingsPanelProps) => (
  <SurfacePanel
    className="create-settings-panel"
    header={
      <div className="settings-header">
        <div>
          <h2 className="settings-title">生成设置</h2>
          <p className="settings-subtitle">保留必要参数，收纳辅助信息，不抢主创作区。</p>
        </div>
      </div>
    }
  >
    <div className="settings-grid">
      <label className="settings-field">
        <span>风格</span>
        <select value={options.style} onChange={(event) => onStyleChange(event.target.value)}>
          {STYLE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field">
        <span>情绪</span>
        <select value={options.mood} onChange={(event) => onMoodChange(event.target.value)}>
          {MOOD_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>

    <label className="settings-field">
      <span>时长 {options.duration}s</span>
      <input
        type="range"
        min="5"
        max="30"
        step="1"
        value={options.duration}
        onChange={(event) => onDurationChange(Number(event.target.value))}
      />
    </label>

    <dl className="settings-meta">
      <div>
        <dt>模型</dt>
        <dd>{findLabel(MODEL_OPTIONS, options.advancedSettings.model)}</dd>
      </div>
      <div>
        <dt>分辨率</dt>
        <dd>{findLabel(RESOLUTION_PRESETS, options.advancedSettings.resolution)}</dd>
      </div>
      <div>
        <dt>导出</dt>
        <dd>{findLabel(EXPORT_PRESETS, options.exportPreset)}</dd>
      </div>
    </dl>
  </SurfacePanel>
);
