import { useId, useMemo, useState } from 'react';
import { Glyph } from './Glyph';

export interface PickerOption {
  id: string;
  label: string;
  deprecated?: boolean;
}

interface PickerProps {
  label: string;
  options: PickerOption[];
  /** The chosen option's id, or null for none. */
  value: string | null;
  onChange: (id: string) => void;
  /** Shown when no option is chosen. */
  placeholder?: string;
  disabled?: boolean;
  /** The text input, for a caller that needs to move focus to it. */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * A list you can type into to narrow it, with the keyboard model of
 * SearchBox: arrows move the active option, Enter picks it, Escape closes.
 * Closed, it shows the chosen option.
 */
export function Picker({ label, options, value, onChange, placeholder, disabled = false, inputRef }: PickerProps) {
  // What has been typed since the list opened; null shows the chosen option.
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputId = useId();
  const listId = useId();

  const shown = useMemo(() => {
    const needle = (query ?? '').trim().toLowerCase();
    return needle === ''
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(needle) || option.id.toLowerCase().includes(needle));
  }, [options, query]);
  const current = options.find((option) => option.id === value);
  const optionId = (index: number) => `${listId}-option-${index}`;

  function close() {
    setOpen(false);
    setQuery(null);
    setActive(-1);
  }

  function choose(index: number) {
    onChange(shown[index].id);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    // Marked handled, so a panel holding the picker leaves itself open.
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (shown.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div className="picker">
      <label className="picker__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        className="picker__input"
        value={query ?? current?.label ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        title={current?.label}
        onClick={() => setOpen(true)}
        // Selected, so typing replaces the chosen option rather than adding to it.
        onFocus={(e) => e.target.select()}
        onBlur={close}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
      />
      {open && (
        <ul className="picker__list" id={listId} role="listbox" aria-label={label}>
          {shown.length === 0 ? (
            <li className="picker__empty">No matches</li>
          ) : (
            shown.map((option, index) => (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                data-id={option.id}
                aria-selected={index === active}
                aria-label={option.deprecated ? `${option.label}, deprecated` : option.label}
                className={[
                  'picker__option',
                  index === active && 'picker__option--active',
                  option.id === value && 'picker__option--current',
                  option.deprecated && 'picker__option--deprecated',
                ].filter(Boolean).join(' ')}
                onMouseDown={(e) => {
                  // Pick before the input can blur and close the list.
                  e.preventDefault();
                  choose(index);
                }}
              >
                {option.deprecated && <Glyph abstraction="Category" size={12} deprecated />}
                <span className="picker__option-label">{option.label}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
