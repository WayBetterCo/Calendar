type CalendarColorDotProps = {
  color: string;
};

export function CalendarColorDot({ color }: CalendarColorDotProps): React.JSX.Element {
  return <span className="calendar-dot" style={{ backgroundColor: color }} aria-hidden="true" />;
}
