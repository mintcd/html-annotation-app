import type { ReactNode } from 'react';
import { Select, type SelectOption } from './design-system/select';

type DropdownOption<T extends string = string> = SelectOption<T>;

interface DropdownProps<T extends string = string> {
  options: ReadonlyArray<DropdownOption<T>>;
  value: T;
  onChange: (value: T) => void;
  buttonContent: ReactNode;
  className?: string;
  ariaLabel?: string;
}

function Dropdown<T extends string = string>({
  options,
  value,
  onChange,
  buttonContent,
  className,
  ariaLabel,
}: DropdownProps<T>) {
  return (
    <Select
      options={options}
      value={value}
      onValueChange={onChange}
      triggerContent={buttonContent}
      ariaLabel={ariaLabel}
      className={className}
      size="small"
    />
  );
}

export default Dropdown;
