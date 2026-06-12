import { format } from 'date-fns';

type DatePickerPopoverProps = {
  value: Date;
  onChange: (date: Date) => void;
};

export function DatePickerPopover({ value, onChange }: DatePickerPopoverProps): React.JSX.Element {
  return (
    <input
      className="date-input"
      type="date"
      aria-label="Select agenda date"
      value={format(value, 'yyyy-MM-dd')}
      onChange={(event) => onChange(new Date(`${event.currentTarget.value}T00:00:00`))}
    />
  );
}
