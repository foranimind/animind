import { ActionButton } from "../ui/ActionButton";
import { SelectMenu, type SelectOption } from "../ui/SelectMenu";

export type FilterOption = SelectOption;

type LibraryFiltersProps = {
  style: string;
  duration: string;
  date: string;
  styleOptions: FilterOption[];
  durationOptions: FilterOption[];
  dateOptions: FilterOption[];
  onStyleChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onClear: () => void;
};

export const LibraryFilters = ({
  style,
  duration,
  date,
  styleOptions,
  durationOptions,
  dateOptions,
  onStyleChange,
  onDurationChange,
  onDateChange,
  onClear,
}: LibraryFiltersProps) => (
  <div className="library-filter-panel">
    <label className="library-filter-field">
      <span>风格</span>
      <SelectMenu
        value={style}
        options={styleOptions}
        ariaLabel="风格"
        className="library-filter-select"
        panelClassName="library-filter-select-panel"
        onChange={onStyleChange}
      />
    </label>
    <label className="library-filter-field">
      <span>时长</span>
      <SelectMenu
        value={duration}
        options={durationOptions}
        ariaLabel="时长"
        className="library-filter-select"
        panelClassName="library-filter-select-panel"
        onChange={onDurationChange}
      />
    </label>
    <label className="library-filter-field">
      <span>日期</span>
      <SelectMenu
        value={date}
        options={dateOptions}
        ariaLabel="日期"
        className="library-filter-select"
        panelClassName="library-filter-select-panel"
        onChange={onDateChange}
      />
    </label>
    <div className="library-filter-actions">
      <ActionButton type="button" variant="ghost" className="library-filter-clear" onClick={onClear}>
        清空筛选
      </ActionButton>
    </div>
  </div>
);
