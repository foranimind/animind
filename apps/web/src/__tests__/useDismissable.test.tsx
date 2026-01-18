import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import { useDismissable } from "../hooks/useDismissable";

const DismissableProbe = ({
  shouldDismiss,
  refsCount = 1,
}: {
  shouldDismiss?: (event: MouseEvent | KeyboardEvent) => boolean;
  refsCount?: number;
}) => {
  const [open, setOpen] = useState(true);
  const firstRef = useRef<HTMLDivElement | null>(null);
  const secondRef = useRef<HTMLDivElement | null>(null);
  const refs = refsCount === 2 ? [firstRef, secondRef] : firstRef;

  useDismissable({
    enabled: open,
    refs,
    onDismiss: () => setOpen(false),
    shouldDismiss,
  });

  return (
    <div>
      <div data-testid="inside-1" ref={firstRef}>
        inside-1
      </div>
      {refsCount === 2 ? (
        <div data-testid="inside-2" ref={secondRef}>
          inside-2
        </div>
      ) : null}
      <div data-testid="outside">outside</div>
      <div data-testid="status">{open ? "open" : "closed"}</div>
    </div>
  );
};

describe("useDismissable", () => {
  it("keeps open when clicking inside any ref", () => {
    render(<DismissableProbe refsCount={2} />);
    fireEvent.mouseDown(screen.getByTestId("inside-1"));
    expect(screen.getByTestId("status")).toHaveTextContent("open");
    fireEvent.mouseDown(screen.getByTestId("inside-2"));
    expect(screen.getByTestId("status")).toHaveTextContent("open");
  });

  it("closes on outside click", () => {
    render(<DismissableProbe />);
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.getByTestId("status")).toHaveTextContent("closed");
  });

  it("closes on Escape", () => {
    render(<DismissableProbe />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("status")).toHaveTextContent("closed");
  });

  it("respects shouldDismiss", () => {
    const shouldDismiss = (event: MouseEvent | KeyboardEvent) => {
      if ("key" in event) {
        return true;
      }
      const target = event.target as HTMLElement | null;
      return target?.getAttribute("data-keep-open") !== "true";
    };
    render(<DismissableProbe shouldDismiss={shouldDismiss} />);
    const outside = screen.getByTestId("outside");
    outside.setAttribute("data-keep-open", "true");
    fireEvent.mouseDown(outside);
    expect(screen.getByTestId("status")).toHaveTextContent("open");
  });
});
