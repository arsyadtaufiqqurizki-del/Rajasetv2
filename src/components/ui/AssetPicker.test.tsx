import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import AssetPicker, { ASSET_PICKER_LIMIT, type AssetPickerOption } from './AssetPicker';

// Pins the contract of the picker extracted from AddMaintenanceModal and
// AddReclassificationModal in Step 7 of "refactoring v2.md". The two callers style
// the trigger and the panel differently and count different lists, so everything
// that differed between them is a prop and is asserted as one here.

const onChange = vi.fn();

const TRIGGER_CLASS = 'trigger-under-test';
const PANEL_CLASS = 'panel-under-test';
const SEARCH_PLACEHOLDER = 'Cari asset number atau deskripsi...';

function options(n: number): AssetPickerOption[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    assetNumber: `AST-${String(i).padStart(3, '0')}`,
    assetDescription: `Machine ${i}`,
  }));
}

function renderPicker(over: Partial<React.ComponentProps<typeof AssetPicker>> = {}) {
  return render(
    <AssetPicker
      assets={options(3)}
      value=""
      onChange={onChange}
      placeholder="Select an asset"
      triggerClassName={TRIGGER_CLASS}
      panelClassName={PANEL_CLASS}
      {...over}
    />,
  );
}

const trigger = () => screen.getAllByRole('button')[0];
const search = () => screen.getByPlaceholderText(SEARCH_PLACEHOLDER);

beforeEach(() => vi.clearAllMocks());

describe('AssetPicker — trigger', () => {
  it('shows the placeholder while nothing is picked and wears the caller class', () => {
    renderPicker();
    expect(trigger()).toHaveTextContent('Select an asset');
    expect(trigger()).toHaveClass(TRIGGER_CLASS);
  });

  it('shows "number - description" once a value is set', () => {
    renderPicker({ value: 'a1' });
    expect(trigger()).toHaveTextContent('AST-001 - Machine 1');
  });

  it('keeps showing the placeholder when the value matches no asset', () => {
    renderPicker({ value: 'gone' });
    expect(trigger()).toHaveTextContent('Select an asset');
  });

  it('mirrors the value into a hidden required input so the form validates', () => {
    const { container } = renderPicker({ value: 'a2' });
    const hidden = container.querySelector('input.sr-only') as HTMLInputElement;
    expect(hidden).toBeRequired();
    expect(hidden).toHaveValue('a2');
    expect(hidden).toHaveAttribute('readonly');
  });
});

describe('AssetPicker — dropdown', () => {
  it('stays closed until the trigger is pressed, and toggles back shut', () => {
    renderPicker();
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();

    fireEvent.click(trigger());
    expect(search()).toBeInTheDocument();

    fireEvent.click(trigger());
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it('wears the caller panel class', () => {
    const { container } = renderPicker();
    fireEvent.click(trigger());
    expect(container.querySelector(`.${PANEL_CLASS}`)).toBeInTheDocument();
  });

  it('closes on a click outside, but not on a click within', () => {
    renderPicker();
    fireEvent.click(trigger());

    fireEvent.mouseDown(search());
    expect(search()).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });
});

describe('AssetPicker — search', () => {
  it('matches on asset number and on description, ignoring case and surrounding space', () => {
    renderPicker();
    fireEvent.click(trigger());

    fireEvent.change(search(), { target: { value: '  ast-001  ' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('AST-001')).toBeInTheDocument();

    fireEvent.change(search(), { target: { value: 'machine 2' } });
    expect(screen.getByText('AST-002')).toBeInTheDocument();
  });

  it('shows the shared empty-state copy when nothing matches', () => {
    renderPicker();
    fireEvent.click(trigger());
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(screen.getByText('Tidak ada hasil')).toBeInTheDocument();
  });

  it('offers a clear button only once something has been typed', () => {
    renderPicker();
    fireEvent.click(trigger());
    const buttonsBefore = screen.getAllByRole('button').length;

    fireEvent.change(search(), { target: { value: 'ast' } });
    const clear = screen.getAllByRole('button')[buttonsBefore];
    fireEvent.click(clear);

    expect(search()).toHaveValue('');
  });
});

describe('AssetPicker — the 50-row cap', () => {
  it('renders at most 50 rows unfiltered', () => {
    renderPicker({ assets: options(60) });
    fireEvent.click(trigger());
    expect(screen.getAllByRole('listitem')).toHaveLength(ASSET_PICKER_LIMIT);
  });

  it('caps the filtered list too', () => {
    renderPicker({ assets: options(200) });
    fireEvent.click(trigger());
    fireEvent.change(search(), { target: { value: 'AST-' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(ASSET_PICKER_LIMIT);
  });

  it('renders the hint from the caller, counting the list it was handed', () => {
    renderPicker({ assets: options(60), renderMoreHint: total => `showing 50 of ${total}` });
    fireEvent.click(trigger());
    expect(screen.getByText('showing 50 of 60')).toBeInTheDocument();
  });

  it('hides the hint while a search is active', () => {
    renderPicker({ assets: options(60), renderMoreHint: total => `showing 50 of ${total}` });
    fireEvent.click(trigger());
    fireEvent.change(search(), { target: { value: 'AST' } });
    expect(screen.queryByText(/showing 50 of/)).not.toBeInTheDocument();
  });

  it('renders no hint at all when the list fits, or when the caller supplies none', () => {
    const { unmount } = renderPicker({ assets: options(10), renderMoreHint: total => `showing 50 of ${total}` });
    fireEvent.click(trigger());
    expect(screen.queryByText(/showing 50 of/)).not.toBeInTheDocument();
    unmount();

    renderPicker({ assets: options(60) });
    fireEvent.click(trigger());
    expect(screen.queryByText(/showing/)).not.toBeInTheDocument();
  });
});

describe('AssetPicker — picking', () => {
  it('reports the id, closes the dropdown and blanks the search', () => {
    renderPicker();
    fireEvent.click(trigger());
    fireEvent.change(search(), { target: { value: 'AST-002' } });
    fireEvent.click(screen.getByText('AST-002'));

    expect(onChange).toHaveBeenCalledWith('a2');
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();

    fireEvent.click(trigger());
    expect(search()).toHaveValue('');
  });

  it('marks the picked row so it reads as selected when the list is reopened', () => {
    renderPicker({ value: 'a1' });
    fireEvent.click(trigger());
    const rows = screen.getAllByRole('listitem');
    expect(rows[1].className).toContain('text-primary');
    expect(rows[0].className).not.toContain('text-primary');
  });

  it('drives a controlled caller — a picked row updates the trigger', () => {
    function Host() {
      const [value, setValue] = useState('');
      return (
        <AssetPicker
          assets={options(3)}
          value={value}
          onChange={setValue}
          placeholder="Select an asset"
          triggerClassName={TRIGGER_CLASS}
          panelClassName={PANEL_CLASS}
        />
      );
    }
    render(<Host />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText('AST-002'));
    expect(trigger()).toHaveTextContent('AST-002 - Machine 2');
  });
});
