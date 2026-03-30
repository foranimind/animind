import {
  EXPORT_PRESETS,
  MODEL_OPTIONS,
  MOOD_OPTIONS,
  RESOLUTION_PRESETS,
  STYLE_OPTIONS,
} from "../../lib/sessionDefaults";
import type { SessionOptions } from "../../lib/storage";
import { SelectMenu, type SelectOption } from "../ui/SelectMenu";
import { SurfacePanel } from "../ui/SurfacePanel";

type CreateSettingsPanelProps = {
  options: SessionOptions;
  onStyleChange: (value: string) => void;
  onMoodChange: (value: string) => void;
  onDurationChange: (value: number) => void;
};

type SettingsOption = {
  id?: string;
  value?: string | readonly [number, number];
  label?: string;
  title?: string;
};

type MetaDisplay = {
  primary: string;
  secondary?: string;
};

const STYLE_SELECT_OPTIONS: SelectOption[] = STYLE_OPTIONS.map((option) => ({
  value: option.id,
  label: option.title,
}));

const MOOD_SELECT_OPTIONS: SelectOption[] = MOOD_OPTIONS.map((option) => ({
  value: option.id,
  label: option.label,
}));

const findOption = (items: SettingsOption[], value: string) =>
  items.find((item) => item.id === value || item.value === value) ?? null;

const getOptionLabel = (item: SettingsOption | null, fallback: string) =>
  item?.label ?? item?.title ?? fallback;

const splitMetaLabel = (label: string): MetaDisplay => {
  const normalized = label.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?)\s*[（(]([^()（）]+)[）)]$/);
  if (!match) {
    return { primary: normalized };
  }
  return {
    primary: match[1]?.trim() ?? normalized,
    secondary: match[2]?.trim() ?? undefined,
  };
};

export const CreateSettingsPanel = ({
  options,
  onStyleChange,
  onMoodChange,
  onDurationChange,
}: CreateSettingsPanelProps) => {
  const modelDisplay = splitMetaLabel(
    getOptionLabel(findOption(MODEL_OPTIONS, options.advancedSettings.model), options.advancedSettings.model)
  );
  const resolutionDisplay = splitMetaLabel(
    getOptionLabel(
      findOption(RESOLUTION_PRESETS, options.advancedSettings.resolution),
      options.advancedSettings.resolution
    )
  );
  const exportDisplay = splitMetaLabel(
    getOptionLabel(findOption(EXPORT_PRESETS, options.exportPreset), options.exportPreset)
  );

  return (
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
          <SelectMenu
            value={options.style}
            options={STYLE_SELECT_OPTIONS}
            ariaLabel="风格"
            className="settings-select"
            onChange={onStyleChange}
          />
        </label>

        <label className="settings-field">
          <span>情绪</span>
          <SelectMenu
            value={options.mood}
            options={MOOD_SELECT_OPTIONS}
            ariaLabel="情绪"
            className="settings-select"
            onChange={onMoodChange}
          />
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
          className="ui-range settings-range"
          onChange={(event) => onDurationChange(Number(event.target.value))}
        />
      </label>

      <dl className="settings-meta">
        <div>
          <dt>模型</dt>
          <dd>
            <span className="settings-meta-primary">{modelDisplay.primary}</span>
            {modelDisplay.secondary ? (
              <span className="settings-meta-secondary">{modelDisplay.secondary}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>分辨率</dt>
          <dd>
            <span className="settings-meta-primary">{resolutionDisplay.primary}</span>
            {resolutionDisplay.secondary ? (
              <span className="settings-meta-secondary">{resolutionDisplay.secondary}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>导出</dt>
          <dd>
            <span className="settings-meta-primary">{exportDisplay.primary}</span>
            {exportDisplay.secondary ? (
              <span className="settings-meta-secondary">{exportDisplay.secondary}</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </SurfacePanel>
  );
};
