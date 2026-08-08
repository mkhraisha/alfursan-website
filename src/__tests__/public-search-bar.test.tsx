/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PublicSearchBar from "../components/PublicSearchBar";

describe("PublicSearchBar", () => {
  it("renders the search input with the given placeholder and value", () => {
    render(
      <PublicSearchBar value="honda" onChange={vi.fn()} placeholder="Search by make, model, or VIN" />,
    );
    const input = screen.getByPlaceholderText("Search by make, model, or VIN");
    expect(input).toHaveValue("honda");
  });

  it("calls onChange as the user types", () => {
    const onChange = vi.fn();
    render(<PublicSearchBar value="" onChange={onChange} placeholder="Search…" />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "accord" } });
    expect(onChange).toHaveBeenCalledWith("accord");
  });

  it("does not render a Filters button when no filters prop is given", () => {
    render(<PublicSearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Filters/i })).not.toBeInTheDocument();
  });

  it("opens and closes the filters popover on click", () => {
    render(
      <PublicSearchBar
        value=""
        onChange={vi.fn()}
        filters={{ activeCount: 0, panel: <div>Panel content</div> }}
      />,
    );
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filters/i }));
    expect(screen.getByText("Panel content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filters/i }));
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("closes the popover when clicking outside", () => {
    render(
      <div>
        <PublicSearchBar
          value=""
          onChange={vi.fn()}
          filters={{ activeCount: 0, panel: <div>Panel content</div> }}
        />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Filters/i }));
    expect(screen.getByText("Panel content")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("shows the active-count badge only when filters are active", () => {
    const { rerender } = render(
      <PublicSearchBar
        value=""
        onChange={vi.fn()}
        filters={{ activeCount: 0, panel: <div /> }}
      />,
    );
    expect(screen.queryByText("3")).not.toBeInTheDocument();

    rerender(
      <PublicSearchBar
        value=""
        onChange={vi.fn()}
        filters={{ activeCount: 3, panel: <div /> }}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows Clear all only once there is a query or an active filter, and calls onClear", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <PublicSearchBar
        value=""
        onChange={vi.fn()}
        filters={{ activeCount: 0, panel: <div />, onClear }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Clear all/i })).not.toBeInTheDocument();

    rerender(
      <PublicSearchBar
        value="honda"
        onChange={vi.fn()}
        filters={{ activeCount: 0, panel: <div />, onClear }}
      />,
    );
    const clearButton = screen.getByRole("button", { name: /Clear all/i });
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders the results label and actions slot", () => {
    render(
      <PublicSearchBar
        value=""
        onChange={vi.fn()}
        resultsLabel="12 Results"
        actions={<span>Sort control</span>}
      />,
    );
    expect(screen.getByText("12 Results")).toBeInTheDocument();
    expect(screen.getByText("Sort control")).toBeInTheDocument();
  });
});
